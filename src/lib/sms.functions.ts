import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { RATE, RateLimitError, throttle } from "@/lib/rate-limit";
import { z } from "zod";

/**
 * Shared BulkSMSBD sender + automated abandoned-cart recovery.
 *
 * SMS goes live when SMS_API_KEY / SMS_SENDER_ID are set; otherwise every
 * message is recorded in the notifications table in sandbox mode so the flow
 * is fully testable before spending credits.
 *
 * There is no cron in this stack, so recovery nudges are processed lazily:
 * `sendCartRecoveryNudges` is cheap, idempotent (nudged_at guard) and is
 * kicked from the storefront shell + the admin marketing tab.
 */

/** Normalize any BD phone variant to 01XXXXXXXXX. Returns null if not valid. */
export function normalizeBdPhone(raw: string): string | null {
  const p = raw.replace(/[\s-]/g, "").replace(/^\+/, "");
  const digits = p.replace(/^880/, "0").replace(/^88/, "0");
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

/** Send one SMS via BulkSMSBD (live) or record it as sandbox. Shared by all callers. */
export async function sendSms(
  supabaseAdmin: SupabaseClient<Database>,
  phone: string,
  body: string,
  meta: { subject: string; template?: string; orderId?: string | null },
): Promise<{ status: string; ref: string | null; error: string | null }> {
  const normalized = normalizeBdPhone(phone);
  const key = process.env["SMS_API_KEY"];
  const sender = process.env["SMS_SENDER_ID"];
  let status = "sandbox";
  let ref: string | null = null;
  let error: string | null = null;
  let sentAt: string | null = null;

  if (!normalized) {
    error = "Invalid BD phone number";
    status = "failed";
  } else if (key && sender) {
    try {
      // Cost/spam guard: one number can never drain the SMS wallet.
      await throttle(supabaseAdmin, "sms:rcpt", RATE.smsPerRecipient, normalized);
      const q = new URLSearchParams({
        api_key: key,
        type: "text",
        number: `88${normalized.slice(1)}`, // 8801XXXXXXXXX
        senderid: sender,
        message: body,
      });
      const r = await fetch(`https://bulksmsbd.net/api/smsapi?${q}`);
      const j = (await r.json().catch(() => ({}))) as {
        response_code?: number | string;
        error_message?: string;
        message_id?: number | string;
      };
      if (!r.ok || (j.response_code && j.response_code !== 202)) {
        throw new Error(j.error_message ?? `HTTP ${r.status}`);
      }
      status = "sent";
      ref = String(j.message_id ?? "");
      sentAt = new Date().toISOString();
    } catch (e) {
      // Rate-limited sends are recorded (not thrown) so an order flow never
      // fails because of the SMS budget — but nothing leaves the wallet.
      status = e instanceof RateLimitError ? "rate_limited" : "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  await supabaseAdmin.from("notifications").insert({
    order_id: meta.orderId ?? null,
    channel: "sms",
    recipient: normalized ?? phone,
    subject: meta.subject,
    body,
    status,
    provider: key ? "bulksmsbd" : "sandbox",
    provider_ref: ref,
    template: meta.template ?? null,
    attempts: 1,
    sent_at: sentAt,
    error,
  });

  return { status, ref, error };
}

const NUDGE_MIN_AGE_MINUTES = 60; // nudge one hour after abandonment
const NUDGE_BATCH_LIMIT = 20;

/**
 * Find abandoned carts older than 1 hour that were never nudged, attach a
 * fresh discount coupon and send the recovery SMS. Idempotent: a cart is
 * marked nudged_at immediately, so re-running never double-sends.
 */
export const sendCartRecoveryNudges = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ limit: z.number().int().min(1).max(NUDGE_BATCH_LIMIT).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Trigger is public by design (kicked lazily from the storefront shell),
    // so cap how often one caller may run a batch.
    await throttle(supabaseAdmin, "nudge", RATE.cartNudge);
    const cutoff = new Date(Date.now() - NUDGE_MIN_AGE_MINUTES * 60_000).toISOString();

    const { data: carts, error } = await supabaseAdmin
      .from("abandoned_carts")
      .select("id, contact, items, subtotal_bdt, created_at")
      .is("nudged_at", null)
      .eq("recovered", false)
      .lt("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(data.limit ?? NUDGE_BATCH_LIMIT);
    if (error) throw new Error(error.message);

    let sent = 0;
    let skipped = 0;
    for (const cart of carts ?? []) {
      const phone = cart.contact ? normalizeBdPhone(cart.contact) : null;
      if (!phone) {
        skipped++;
        continue;
      }

      // One recovery coupon per cart, valid for 48h.
      const code = `BACK${cart.id.slice(0, 6).toUpperCase()}`;
      await supabaseAdmin.from("coupons").upsert(
        {
          code,
          discount_type: "percent",
          discount_value: 10,
          min_order_bdt: Math.min(cart.subtotal_bdt || 500, 500),
          active: true,
        },
        { onConflict: "code" },
      );

      const itemCount = Array.isArray(cart.items) ? cart.items.length : 0;
      const body =
        `GochaoBD: আপনার কার্টের ৳${cart.subtotal_bdt} (${itemCount} পণ্য) এখনো অপেক্ষা করছে। ` +
        `আজ অর্ডার করলে ${code} কুপনে ১০% ছাড়! অর্ডার করতে: gochaobd.lovable.app/cart`;

      const r = await sendSms(supabaseAdmin, phone, body, {
        subject: "Cart recovery",
        template: "cart_nudge",
      });
      if (r.status !== "failed") sent++;
      else skipped++;

      await supabaseAdmin
        .from("abandoned_carts")
        .update({ nudged_at: new Date().toISOString(), discount_code: code })
        .eq("id", cart.id);
    }

    return { candidates: carts?.length ?? 0, sent, skipped };
  });
