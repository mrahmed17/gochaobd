import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";
import { RATE, throttle } from "@/lib/rate-limit";

async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!roles?.some((r: any) => r.role === "admin"))
    throw new Response("Forbidden", { status: 403 });
  // Revocation stamp (see admin.functions.assertAdmin): a kicked account
  // loses every server-side admin action at once.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  const meta = (u?.user?.app_metadata ?? {}) as { auth_revoked_at?: string };
  if (meta.auth_revoked_at) throw new Response("Session revoked", { status: 401 });
}

/* ---------------- Photo upload (private bucket, long-lived signed links) ---------------- */

export const uploadImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        folder: z.enum(["products", "categories", "stores"]),
        fileName: z.string().max(200),
        contentType: z.string().regex(/^image\/(png|jpe?g|webp|gif|avif)$/),
        base64: z.string().max(7_500_000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const ext = data.contentType.split("/")[1].replace("jpeg", "jpg");
    const path = `${data.folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("media")
      .upload(path, bytes, { contentType: data.contentType });
    if (error) throw new Error(error.message);
    const { data: signed, error: e2 } = await supabaseAdmin.storage
      .from("media")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (e2 || !signed) throw new Error(e2?.message ?? "Could not create link");
    return { url: signed.signedUrl };
  });

/* ---------------- Delivery tracking ---------------- */

export const saveOrderDelivery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        courier: z.string().max(60).nullable(),
        tracking_number: z.string().max(80).nullable(),
        delivery_note: z.string().max(500).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...fields } = data;
    const { error } = await supabaseAdmin.from("orders").update(fields).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------------- Sales report ---------------- */

export const getSalesReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("id, created_at, total_bdt, status, order_items(product_name, qty, unit_price_bdt)")
      .gte("created_at", `${data.from}T00:00:00+06:00`)
      .lte("created_at", `${data.to}T23:59:59+06:00`)
      .neq("status", "cancelled")
      .limit(5000);
    if (error) throw new Error(error.message);
    const byDay: Record<string, { date: string; orders: number; revenue: number }> = {};
    const byProduct: Record<string, { product: string; qty: number; revenue: number }> = {};
    for (const o of orders ?? []) {
      const day = new Date(new Date(o.created_at).getTime() + 6 * 3600_000)
        .toISOString()
        .slice(0, 10);
      byDay[day] ??= { date: day, orders: 0, revenue: 0 };
      byDay[day].orders++;
      byDay[day].revenue += o.total_bdt;
      for (const it of (o as any).order_items ?? []) {
        byProduct[it.product_name] ??= { product: it.product_name, qty: 0, revenue: 0 };
        byProduct[it.product_name].qty += it.qty;
        byProduct[it.product_name].revenue += it.qty * it.unit_price_bdt;
      }
    }
    return {
      days: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
      products: Object.values(byProduct).sort((a, b) => b.revenue - a.revenue),
    };
  });

/* ---------------- AI business assistant ---------------- */

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ question: z.string().min(2).max(1000) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("AI is not configured");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Daily budget per admin so a runaway loop cannot burn the AI key.
    await throttle(supabaseAdmin, "ai", RATE.aiAsk, context.userId);
    const since = new Date(Date.now() - 90 * 86400_000).toISOString();
    const [{ data: orders }, { data: products }] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select(
          "order_number, created_at, status, payment_method, payment_status, total_bdt, delivery_zone, city, order_items(product_name, qty, unit_price_bdt)",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(400),
      supabaseAdmin
        .from("products")
        .select("name, price_bdt, stock, rating, review_count, is_flash_sale")
        .limit(500),
    ]);
    const storeData = JSON.stringify({
      today: new Date().toISOString().slice(0, 10),
      currency: "BDT",
      orders_last_90_days: (orders ?? []).map((o: any) => ({
        n: o.order_number,
        d: o.created_at.slice(0, 10),
        s: o.status,
        pm: o.payment_method,
        ps: o.payment_status,
        t: o.total_bdt,
        z: o.delivery_zone,
        c: o.city,
        items: (o.order_items ?? []).map((i: any) => [i.product_name, i.qty, i.unit_price_bdt]),
      })),
      products: products ?? [],
    });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        input: [
          {
            role: "system",
            content:
              "You are the business analyst for GochaoBD, a Bangladeshi online store. Answer the admin's question using ONLY the JSON store data provided. Give concrete numbers (৳), short bullet points and 1-3 practical recommendations. Reply in the same language as the question (Bangla or English). Keep it under 250 words. If the data cannot answer it, say so.",
          },
          { role: "user", content: `Store data:\n${storeData}\n\nQuestion: ${data.question}` },
        ],
      }),
    });
    if (!res.ok || !res.body) {
      const msg = await res.text().catch(() => "");
      console.error("AI gateway error", res.status, msg);
      if (res.status === 402)
        throw new Error("AI credits are used up. Please add credits in workspace billing.");
      if (res.status === 429)
        throw new Error("Too many AI requests right now. Please try again in a minute.");
      throw new Error(`AI request failed (${res.status})`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let answer = "";
    let failure: string | null = null;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        let ev: any;
        try {
          ev = JSON.parse(payload);
        } catch {
          continue;
        }
        if (ev.type === "response.output_text.delta") answer += ev.delta;
        if (ev.type === "error" || ev.type === "response.failed")
          failure = ev.error?.message ?? ev.response?.error?.message ?? "AI failed";
      }
    }
    if (failure && !answer) throw new Error(failure);
    return { answer: answer.trim() || "No answer was produced. Please rephrase your question." };
  });

/* ---------------- Courier dispatch + SMS outbox ----------------
   Payloads are built in each provider's real format. When the provider's
   API keys are set (STEADFAST_API_KEY/STEADFAST_SECRET_KEY, SMS_API_KEY/SMS_SENDER_ID)
   the call goes live; otherwise it is recorded in sandbox mode. */

const SMS_TEMPLATES = {
  confirmed: (o: any) =>
    `GochaoBD: Your order ${o.order_number} (৳${o.total_bdt}) is confirmed. Thank you!`,
  shipped: (o: any) =>
    `GochaoBD: Order ${o.order_number} has been handed to ${o.courier ?? "our courier"}${o.tracking_number ? `, tracking ${o.tracking_number}` : ""}.`,
  delivered: (o: any) => `GochaoBD: Order ${o.order_number} delivered. Hope you love it!`,
} as const;

/** Core single-order courier dispatch, shared by the one-order and bulk endpoints. */
async function dispatchOrderCore(
  supabaseAdmin: SupabaseClient<Database>,
  o: Tables<"orders">,
  courier: "Steadfast" | "Pathao",
  userId: string,
) {
  if (o.status === "cancelled") throw new Error("Cancelled orders cannot be dispatched");
  const cod = o.payment_status === "paid" ? 0 : o.total_bdt;
  const address = [o.address_line, o.city, o.district].filter(Boolean).join(", ");
  const payload =
    courier === "Steadfast"
      ? {
          invoice: o.order_number,
          recipient_name: o.customer_name,
          recipient_phone: o.customer_phone,
          recipient_address: address,
          cod_amount: cod,
          note: o.delivery_note ?? o.notes ?? "",
        }
      : {
          merchant_order_id: o.order_number,
          recipient_name: o.customer_name,
          recipient_phone: o.customer_phone,
          recipient_address: address,
          delivery_type: 48,
          item_type: 2,
          item_quantity: 1,
          item_weight: 0.5,
          amount_to_collect: cod,
          special_instruction: o.delivery_note ?? "",
        };

  let mode = "sandbox",
    status = "queued",
    consignment: string | null = `SBX-${Date.now().toString(36).toUpperCase()}`,
    tracking: string | null = consignment,
    response: any = { sandbox: true },
    error: string | null = null;
  const key = process.env["STEADFAST_API_KEY"],
    secret = process.env["STEADFAST_SECRET_KEY"];
  if (courier === "Steadfast" && key && secret) {
    mode = "live";
    try {
      const r = await fetch("https://portal.packzy.com/api/v1/create_order", {
        method: "POST",
        headers: { "Api-Key": key, "Secret-Key": secret, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      response = await r.json().catch(() => ({}));
      if (!r.ok || !response?.consignment) throw new Error(response?.message ?? `HTTP ${r.status}`);
      consignment = String(response.consignment.consignment_id);
      tracking = response.consignment.tracking_code ?? null;
      status = response.consignment.status ?? "in_review";
    } catch (e: any) {
      status = "failed";
      error = e.message;
      consignment = null;
      tracking = null;
    }
  }
  await supabaseAdmin.from("courier_dispatches").insert({
    order_id: o.id,
    courier,
    mode,
    status,
    consignment_id: consignment,
    tracking_code: tracking,
    cod_amount_bdt: cod,
    request_payload: payload,
    response_payload: response,
    error,
    created_by: userId,
  });
  if (status === "failed") throw new Error(`Courier rejected: ${error}`);
  await supabaseAdmin
    .from("orders")
    .update({
      courier,
      consignment_id: consignment,
      tracking_number: tracking,
      courier_status: status,
      dispatched_at: new Date().toISOString(),
      status: o.status === "delivered" ? o.status : "shipped",
      shipped_at: o.shipped_at ?? new Date().toISOString(),
    })
    .eq("id", o.id);
  return { mode, consignment, tracking };
}

export const dispatchToCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ orderId: z.string().uuid(), courier: z.enum(["Steadfast", "Pathao"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!o) throw new Error("Order not found");
    return dispatchOrderCore(supabaseAdmin, o, data.courier, context.userId);
  });

/**
 * Bulk warehouse dispatch: send up to 50 selected orders to a courier in one
 * click. Per-order failures don't abort the batch — the response reports
 * exactly which order numbers failed and why.
 */
export const bulkDispatchToCourier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderIds: z.array(z.string().uuid()).min(1).max(50),
        courier: z.enum(["Steadfast", "Pathao"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orders, error } = await supabaseAdmin
      .from("orders")
      .select("*")
      .in("id", data.orderIds);
    if (error) throw new Error(error.message);
    const byId = new Map<string, Tables<"orders">>((orders ?? []).map((o) => [o.id, o]));
    let ok = 0;
    const failed: { order: string; error: string }[] = [];
    for (const id of data.orderIds) {
      const o = byId.get(id);
      if (!o) {
        failed.push({ order: id, error: "Not found" });
        continue;
      }
      try {
        await dispatchOrderCore(supabaseAdmin, o, data.courier, context.userId);
        ok++;
      } catch (e) {
        failed.push({
          order: o.order_number,
          error: e instanceof Error ? e.message : "Failed",
        });
      }
    }
    return { ok, failed };
  });

export const sendOrderSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        orderId: z.string().uuid(),
        template: z.enum(["confirmed", "shipped", "delivered"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendSms } = await import("@/lib/sms.functions");
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", data.orderId)
      .maybeSingle();
    if (!o) throw new Error("Order not found");
    const body = SMS_TEMPLATES[data.template](o);
    const r = await sendSms(supabaseAdmin, o.customer_phone, body, {
      subject: data.template,
      template: data.template,
      orderId: o.id,
    });
    if (r.status === "failed") throw new Error(`SMS failed: ${r.error}`);
    return { status: r.status };
  });

export const getOrderComms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [d, n] = await Promise.all([
      supabaseAdmin
        .from("courier_dispatches")
        .select("id, courier, mode, status, consignment_id, cod_amount_bdt, error, created_at")
        .eq("order_id", data.orderId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("notifications")
        .select("id, channel, recipient, body, status, error, created_at")
        .eq("order_id", data.orderId)
        .order("created_at", { ascending: false }),
    ]);
    return { dispatches: d.data ?? [], messages: n.data ?? [] };
  });
