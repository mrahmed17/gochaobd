import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { RATE, throttle } from "@/lib/rate-limit";
import { z } from "zod";

const DELIVERY_FEES: Record<string, number> = { dhaka: 60, suburb: 100, outside: 130 };
const FREE_SHIPPING_THRESHOLD = 1500;

type Admin = SupabaseClient<Database>;

/** Columns needed to rebuild placeOrder's success payload from an existing order. */
const DUP_FIELDS =
  "id, order_number, total_bdt, subtotal_bdt, shipping_bdt, discount_bdt, bundle_discount_bdt, risk_score, payment_method";

interface OrderResult {
  orderNumber: string;
  paymentKey: string;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  bundleDiscount: number;
  riskScore: number;
  requiresPayment: boolean;
  provider: string | null;
  /** true when this checkout session already produced the order (retry/double-click) */
  duplicate: boolean;
}

/** Same shape as placeOrder's return, rebuilt from the order a session already created. */
function duplicateResult(o: {
  id: string;
  order_number: string;
  total_bdt: number;
  subtotal_bdt: number;
  shipping_bdt: number;
  discount_bdt: number;
  bundle_discount_bdt: number;
  risk_score: number;
  payment_method: string;
}): OrderResult {
  const online = o.payment_method !== "cod";
  return {
    orderNumber: o.order_number,
    paymentKey: o.id,
    total: o.total_bdt,
    subtotal: o.subtotal_bdt,
    shipping: o.shipping_bdt,
    discount: o.discount_bdt,
    bundleDiscount: o.bundle_discount_bdt,
    riskScore: o.risk_score,
    requiresPayment: online,
    provider: online ? o.payment_method : null,
    duplicate: true,
  };
}

/** Idempotency probe: has this checkout session already produced an order? */
async function findOrderBySession(supabaseAdmin: Admin, sessionKey: string) {
  const { data } = await supabaseAdmin
    .from("orders")
    .select(DUP_FIELDS)
    .eq("checkout_session_key", sessionKey)
    .maybeSingle();
  return data ? duplicateResult(data) : null;
}

const orderInput = z.object({
  customer: z.object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().min(6).max(20),
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    address: z.string().trim().min(4).max(500),
    city: z.string().trim().min(2).max(80),
    district: z.string().trim().max(80).optional().or(z.literal("")),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    zone: z.enum(["dhaka", "suburb", "outside"]),
    payment: z.enum(["cod", "bkash", "nagad"]),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variant: z.string().trim().max(120).nullish(),
        qty: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
  couponCode: z.string().trim().max(40).nullish(),
  /** Opaque checkout session key used for the 10-minute stock hold. */
  checkoutSessionKey: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[A-Za-z0-9_-]+$/)
    .nullish(),
});

/** Public coupon check — validated server-side; the coupons table is not publicly readable. */
export const checkCoupon = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ code: z.string().trim().min(1).max(40) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await supabaseAdmin
      .from("coupons")
      .select("code, discount_type, discount_value, min_order_bdt")
      .eq("code", data.code.toUpperCase())
      .eq("active", true)
      .maybeSingle();
    return { coupon: c ?? null };
  });

/**
 * Server-side order placement. All financial values (unit prices, subtotal,
 * shipping, coupon discount, total) are recomputed from the database —
 * client-supplied amounts are never trusted.
 */
export const placeOrder = createServerFn({ method: "POST" })
  .inputValidator((data) => orderInput.parse(data))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 0) Idempotency: a double-click, or a retry after a network timeout, must
    //    return the order this session already created instead of inserting a
    //    second one and claiming its stock again (double-spend guard).
    const sessionKey = data.checkoutSessionKey ?? null;
    if (sessionKey) {
      const dup = await findOrderBySession(supabaseAdmin, sessionKey);
      if (dup) return dup;
    }

    // 1) Re-fetch live product prices
    const ids = [...new Set(data.items.map((i) => i.productId))];
    const { data: products, error: pErr } = await supabaseAdmin
      .from("products")
      .select("id, name, images, price_bdt, flash_price_bdt, store_id")
      .in("id", ids);
    if (pErr) throw new Error("Could not verify products");
    const byId = new Map((products ?? []).map((p) => [p.id, p]));

    // 2) Re-fetch variant price deltas
    const { data: variants } = await supabaseAdmin
      .from("product_variants")
      .select("product_id, label, price_delta_bdt")
      .in("product_id", ids);
    const variantDelta = new Map(
      (variants ?? []).map((v) => [`${v.product_id}::${v.label}`, v.price_delta_bdt]),
    );

    // 3) Compute canonical line items and subtotal
    const lines = data.items.map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw new Error("A product in your cart is no longer available");
      const base = p.flash_price_bdt ?? p.price_bdt;
      const delta = i.variant ? (variantDelta.get(`${i.productId}::${i.variant}`) ?? 0) : 0;
      return {
        product_id: p.id,
        product_name: p.name,
        product_image: p.images?.[0] ?? null,
        variant_label: i.variant ?? null,
        unit_price_bdt: base + delta,
        qty: i.qty,
      };
    });
    const subtotal = lines.reduce((s, l) => s + l.unit_price_bdt * l.qty, 0);

    // 3b) Bundle deals: "frequently bought together" pairs carry a fixed discount.
    // Applied automatically when the cart contains both products of an active pair.
    const { data: bundles } = await supabaseAdmin
      .from("product_bundles")
      .select("product_id, with_product_id, discount_bdt")
      .eq("active", true)
      .or(`product_id.in.(${ids.join(",")}),with_product_id.in.(${ids.join(",")})`);
    const idSet = new Set(ids);
    let bundleDiscount = 0;
    for (const b of bundles ?? []) {
      if (idSet.has(b.product_id) && idSet.has(b.with_product_id) && b.discount_bdt > 0) {
        bundleDiscount += b.discount_bdt;
      }
    }

    // 3c) Courier fraud score: look up this phone's return/cancel history.
    // Runs BEFORE the stock claim so a blocked number never holds inventory.
    let riskScore = 0;
    let riskNote: string | null = null;
    const phone = data.customer.phone
      .replace(/[\s-]/g, "")
      .replace(/^\+?88/, "")
      .replace(/^880/, "0");
    if (/^01[3-9]\d{8}$/.test(phone)) {
      const { data: risk } = await supabaseAdmin
        .from("phone_risk")
        .select("returned_count, cancelled_count, order_count, blocked, note")
        .eq("phone", phone)
        .maybeSingle();
      if (risk) {
        if (risk.blocked) {
          throw new Error("এই নম্বরে অর্ডার করা যাচ্ছে না। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।");
        }
        // 0-100 scale: each return weighs heavily, each cancel lightly.
        riskScore = Math.min(100, risk.returned_count * 40 + risk.cancelled_count * 15);
        if (riskScore >= 40) {
          riskNote = `${risk.returned_count} returns / ${risk.cancelled_count} cancels on this number`;
        }
      }
    }

    // 3d) Atomically claim stock (SELECT ... FOR UPDATE in SQL) so two
    // simultaneous flash-sale checkouts can never oversell the last unit.
    const claimItems = lines.map((l) => ({ product_id: l.product_id, qty: l.qty }));
    const { error: claimErr } = await supabaseAdmin.rpc("claim_stock", {
      p_session: sessionKey,
      p_items: claimItems,
    });
    if (claimErr) {
      // A concurrent retry of this same attempt may have created the order a
      // moment ago and taken the last units — return that order, don't fail.
      if (sessionKey) {
        const dup = await findOrderBySession(supabaseAdmin, sessionKey);
        if (dup) return dup;
      }
      const m = claimErr.message.match(/^OUT_OF_STOCK:(.+):(\d+)$/);
      throw new Error(
        m ? `"${m[1]}"-এর মাত্র ${m[2]}টি বাকি আছে — কার্ট আপডেট করুন` : claimErr.message,
      );
    }

    // 4) Shipping from the server-side fee table
    const shipping =
      subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : (DELIVERY_FEES[data.customer.zone] ?? 130);

    // 5) Verify coupon against the coupons table
    let discount = 0;
    let couponCode: string | null = null;
    if (data.couponCode) {
      const { data: c } = await supabaseAdmin
        .from("coupons")
        .select("code, discount_type, discount_value, min_order_bdt")
        .eq("code", data.couponCode.toUpperCase())
        .eq("active", true)
        .maybeSingle();
      if (c && subtotal >= c.min_order_bdt) {
        discount =
          c.discount_type === "percent"
            ? Math.round((subtotal * c.discount_value) / 100)
            : c.discount_value;
        couponCode = c.code;
      }
    }
    const total = Math.max(0, subtotal + shipping - discount - bundleDiscount);

    // 6) Identify the caller if signed in (optional — guest checkout supported)
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const authHeader = getRequestHeader("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      },
    );
    let userId: string | null = null;
    let userEmail: string | null = null;
    if (token) {
      const { data: u } = await supabase.auth.getUser(token);
      userId = u.user?.id ?? null;
      userEmail = u.user?.email ?? null;
    }

    // Which store (brand) does this order belong to? Taken from the first product.
    const storeId = (products ?? []).find((p: any) => p.store_id)?.store_id ?? null;
    const online = data.customer.payment !== "cod";

    const { data: order, error: oErr } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        store_id: storeId,
        guest_email: userEmail ?? (data.customer.email || null),
        customer_name: data.customer.name,
        customer_phone: data.customer.phone,
        address_line: data.customer.address,
        city: data.customer.city,
        district: data.customer.district || null,
        delivery_zone: data.customer.zone,
        notes: data.customer.notes || null,
        payment_method: data.customer.payment,
        payment_provider: online ? data.customer.payment : null,
        payment_status: online ? "awaiting" : "pending",
        subtotal_bdt: subtotal,
        shipping_bdt: shipping,
        discount_bdt: discount,
        bundle_discount_bdt: bundleDiscount,
        risk_score: riskScore,
        risk_note: riskNote,
        total_bdt: total,
        coupon_code: couponCode,
        checkout_session_key: sessionKey,
      })
      .select("id, order_number")
      .single();
    if (oErr || !order) {
      // Give the claimed stock back — no order was created.
      await supabaseAdmin.rpc("restore_stock", { p_items: claimItems });
      // Unique violation on checkout_session_key: a concurrent retry of this
      // same attempt won the race — return ITS order (stock restored above).
      if (oErr?.code === "23505" && sessionKey) {
        const dup = await findOrderBySession(supabaseAdmin, sessionKey);
        if (dup) return dup;
      }
      throw new Error(oErr?.message ?? "Could not create order");
    }

    const { error: iErr } = await supabaseAdmin
      .from("order_items")
      .insert(lines.map((l) => ({ ...l, order_id: order.id })));
    if (iErr) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      await supabaseAdmin.rpc("restore_stock", { p_items: claimItems });
      throw new Error(iErr.message);
    }

    // Update the phone's lifetime counters so the fraud score keeps learning.
    if (phone && /^01[3-9]\d{8}$/.test(phone)) {
      const { data: existing } = await supabaseAdmin
        .from("phone_risk")
        .select("phone, order_count")
        .eq("phone", phone)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("phone_risk")
          .update({ order_count: existing.order_count + 1, updated_at: new Date().toISOString() })
          .eq("phone", phone);
      } else {
        await supabaseAdmin.from("phone_risk").insert({ phone, order_count: 1 });
      }
    }

    const recipient = userEmail ?? (data.customer.email || data.customer.phone);
    if (recipient) {
      await supabaseAdmin.from("notifications").insert({
        order_id: order.id,
        channel: userEmail || data.customer.email ? "email" : "sms",
        recipient,
        subject: `Order ${order.order_number} confirmed`,
        body: `Thank you ${data.customer.name}! Your GochaoBD order ${order.order_number} for ৳${total} is confirmed. Payment: ${data.customer.payment.toUpperCase()}.`,
        // Sandbox mode: messages are recorded here until a real email/SMS provider is connected.
        status: "sandbox",
      });
    }

    // Loyalty: 1 point per ৳100 spent, and clear any abandoned-cart record.
    if (userId) {
      const { data: loy } = await supabaseAdmin
        .from("loyalty")
        .select("points")
        .eq("user_id", userId)
        .maybeSingle();
      const earned = Math.floor(total / 100);
      if (loy)
        await supabaseAdmin
          .from("loyalty")
          .update({ points: (loy.points ?? 0) + earned })
          .eq("user_id", userId);
      else await supabaseAdmin.from("loyalty").insert({ user_id: userId, points: earned });
      await supabaseAdmin
        .from("abandoned_carts")
        .update({ recovered: true })
        .eq("user_id", userId)
        .eq("recovered", false);
    }

    return {
      orderNumber: order.order_number,
      // Unguessable per-order key; required to open the payment page.
      paymentKey: order.id,
      total,
      subtotal,
      shipping,
      discount,
      bundleDiscount,
      riskScore,
      requiresPayment: online,
      provider: online ? data.customer.payment : null,
      duplicate: false,
    };
  });

/* ---------------- Sandbox mobile payments (bKash / Nagad) ----------------
   Test-mode only: no real money moves. Replace these two handlers with the
   provider's checkout + verify calls once live merchant credentials exist. */

const payInput = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  paymentKey: z.string().uuid(),
});

export const getPaymentSession = createServerFn({ method: "POST" })
  .inputValidator((d) => payInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("order_number, total_bdt, payment_method, payment_status, payment_ref")
      .eq("id", data.paymentKey)
      .eq("order_number", data.orderNumber.toUpperCase())
      .maybeSingle();
    if (!o) throw new Error("Order not found");
    return o;
  });

/** Customer submits their transaction ID. The order is NOT marked paid —
 *  it waits as "verifying" until an admin confirms the payment. */
export const confirmSandboxPayment = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    payInput
      .extend({
        senderNumber: z.string().trim().min(6).max(20),
        trxId: z.string().trim().min(4).max(40),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const number = data.orderNumber.toUpperCase();
    const trx = data.trxId.toUpperCase();

    // Abuse budget: this form is a cheap way to grind orders or replies.
    await throttle(supabaseAdmin, "pay", RATE.paymentSubmit);
    await throttle(supabaseAdmin, "pay:order", RATE.paymentOrder, data.paymentKey);

    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, payment_method, payment_trx")
      .eq("id", data.paymentKey)
      .eq("order_number", number)
      .maybeSingle();
    if (!o) throw new Error("Order not found");
    if (o.payment_status === "paid") return { ok: true as const, alreadyPaid: true };
    if (o.payment_method === "cod") throw new Error("This order is cash on delivery");

    // Same TRX submitted again (double-click / retry): idempotent success.
    if (o.payment_trx === trx) return { ok: true as const, alreadyPaid: false };

    const ref = `${trx} (from ${data.senderNumber})`;
    const { data: updated, error } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "verifying", payment_ref: ref, payment_trx: trx })
      .eq("id", o.id)
      .is("payment_trx", null) // only while this order hasn't submitted one yet
      .select("id");
    if (error) {
      // Unique violation: one transaction can only ever pay ONE order.
      if (error.code === "23505")
        throw new Error(
          "এই ট্রানজাকশন আইডি ইতিমধ্যে অন্য একটি অর্ডারে ব্যবহৃত হয়েছে — স্টেটমেন্ট মিলিয়ে দেখুন",
        );
      throw new Error("Could not submit payment");
    }
    if (!updated?.length) {
      // 0 rows: a concurrent submit for THIS order already stored a TRX.
      const { data: now } = await supabaseAdmin
        .from("orders")
        .select("payment_trx")
        .eq("id", o.id)
        .maybeSingle();
      if (now?.payment_trx === trx) return { ok: true as const, alreadyPaid: false };
      throw new Error("এই অর্ডারে একটি ট্রানজাকশন আইডি আগেই জমা হয়েছে — সাপোর্টে যোগাযোগ করুন");
    }
    return { ok: true as const, alreadyPaid: false };
  });

/* ---------------- Public order tracking ----------------
   /track used to read `orders` with the public anon key, which RLS correctly
   hides, so every guest saw "Order not found". This is the supported path:
   it verifies order number AND phone, returns a pruned projection (never the
   internal id — that is also the payment key) and is rate-limited against
   enumeration. */

const trackInput = z.object({
  orderNumber: z.string().trim().min(4).max(40),
  phone: z.string().trim().min(6).max(20),
});

/** Same normalization placeOrder uses, so raw and stored numbers compare equal. */
const normalizePhone = (raw: string) =>
  raw
    .replace(/[\s-]/g, "")
    .replace(/^\+?88/, "")
    .replace(/^880/, "0");

export const trackOrder = createServerFn({ method: "POST" })
  .inputValidator((d) => trackInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await throttle(supabaseAdmin, "track", RATE.track);

    const { data: o } = await supabaseAdmin
      .from("orders")
      .select(
        "order_number, status, created_at, shipped_at, delivered_at, courier, tracking_number, customer_name, customer_phone, address_line, city, district, payment_method, payment_status, total_bdt, order_items(product_name, variant_label, qty, unit_price_bdt, product_image)",
      )
      .eq("order_number", data.orderNumber.toUpperCase())
      .maybeSingle();
    // Identical answer for "no such order" and "wrong phone", so the endpoint
    // cannot be used to discover which order numbers exist.
    if (!o || normalizePhone(o.customer_phone) !== normalizePhone(data.phone))
      throw new Error("Order not found. Please check the order number and phone.");
    return o;
  });
