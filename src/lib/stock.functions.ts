import { createServerFn } from "@tanstack/react-start";
import { RATE, throttle } from "@/lib/rate-limit";
import { z } from "zod";

/**
 * Checkout stock reservation.
 *
 * A customer who reaches /checkout gets a 10-minute soft hold on each line
 * (`stock_holds` via the reserve_stock SQL function). Holds are keyed by an
 * opaque browser session key, so another shopper's checkout can't take the
 * last unit. placeOrder() then atomically claims the same stock with
 * SELECT ... FOR UPDATE inside claim_stock(), which closes the race window
 * between "check" and "decrement" — no overselling during flash sales.
 */

const itemsSchema = z
  .array(z.object({ productId: z.string().uuid(), qty: z.number().int().min(1).max(99) }))
  .min(1)
  .max(50);

const sessionSchema = z
  .string()
  .trim()
  .min(8)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);

export const holdStock = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        sessionKey: sessionSchema,
        items: itemsSchema,
        minutes: z.number().int().min(1).max(60).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Flash-sale DoS guard: one IP cannot pin every unit behind 10-min holds.
    await throttle(supabaseAdmin, "hold", RATE.holdStock);
    const { error } = await supabaseAdmin.rpc("reserve_stock", {
      p_session: data.sessionKey,
      p_items: data.items.map((i) => ({ product_id: i.productId, qty: i.qty })),
      p_minutes: data.minutes ?? 10,
    });
    if (error) {
      // "OUT_OF_STOCK:<name>:<available>" from the SQL function
      const m = error.message.match(/^OUT_OF_STOCK:(.+):(\d+)$/);
      if (m)
        return {
          ok: false as const,
          message: `"${m[1]}"-এর মাত্র ${m[2]}টি বাকি আছে`,
          product: m[1],
          available: Number(m[2]),
        };
      return { ok: false as const, message: error.message };
    }
    return { ok: true as const };
  });

export const releaseStock = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ sessionKey: sessionSchema }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("release_stock", {
      p_session: data.sessionKey,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Generate a browser-scoped checkout session key (opaque, non-PII). */
export function newCheckoutSessionKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().replace(/-/g, "")
    : `ck${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
