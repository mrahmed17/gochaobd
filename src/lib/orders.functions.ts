import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const DELIVERY_FEES: Record<string, number> = { dhaka: 60, suburb: 100, outside: 130 };
const FREE_SHIPPING_THRESHOLD = 1500;

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
    const variantDelta = new Map((variants ?? []).map((v) => [`${v.product_id}::${v.label}`, v.price_delta_bdt]));

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

    // 4) Shipping from the server-side fee table
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : (DELIVERY_FEES[data.customer.zone] ?? 130);

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
        discount = c.discount_type === "percent" ? Math.round((subtotal * c.discount_value) / 100) : c.discount_value;
        couponCode = c.code;
      }
    }
    const total = Math.max(0, subtotal + shipping - discount);

    // 6) Identify the caller if signed in (optional — guest checkout supported)
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const authHeader = getRequestHeader("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const supabase = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
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
        total_bdt: total,
        coupon_code: couponCode,
      })
      .select("id, order_number")
      .single();
    if (oErr || !order) throw new Error(oErr?.message ?? "Could not create order");

    const { error: iErr } = await supabaseAdmin
      .from("order_items")
      .insert(lines.map((l) => ({ ...l, order_id: order.id })));
    if (iErr) {
      // Stock is reserved atomically per line; roll back the order if any line can't be fulfilled.
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      const m = /OUT_OF_STOCK: (.*)/.exec(iErr.message);
      throw new Error(m ? `দুঃখিত, "${m[1]}" পর্যাপ্ত স্টকে নেই। পরিমাণ কমিয়ে আবার চেষ্টা করুন।` : "Could not place order");
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
      const { data: loy } = await supabaseAdmin.from("loyalty").select("points").eq("user_id", userId).maybeSingle();
      const earned = Math.floor(total / 100);
      if (loy) await supabaseAdmin.from("loyalty").update({ points: (loy.points ?? 0) + earned }).eq("user_id", userId);
      else await supabaseAdmin.from("loyalty").insert({ user_id: userId, points: earned });
      await supabaseAdmin.from("abandoned_carts").update({ recovered: true }).eq("user_id", userId).eq("recovered", false);
    }

    return {
      orderNumber: order.order_number,
      // Unguessable per-order key; required to open the payment page.
      paymentKey: order.id,
      total, subtotal, shipping, discount,
      requiresPayment: online,
      provider: online ? data.customer.payment : null,
    };
  });

/* ---------------- Sandbox mobile payments (bKash / Nagad) ----------------
   Test-mode only: no real money moves. Replace these two handlers with the
   provider's checkout + verify calls once live merchant credentials exist. */

const payInput = z.object({ orderNumber: z.string().trim().min(4).max(40), paymentKey: z.string().uuid() });

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
    payInput.extend({
      senderNumber: z.string().trim().min(6).max(20),
      trxId: z.string().trim().min(4).max(40),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const number = data.orderNumber.toUpperCase();
    const { data: o } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, payment_method")
      .eq("id", data.paymentKey)
      .eq("order_number", number)
      .maybeSingle();
    if (!o) throw new Error("Order not found");
    if (o.payment_status === "paid") return { ok: true as const, alreadyPaid: true };
    if (o.payment_method === "cod") throw new Error("This order is cash on delivery");

    const ref = `${data.trxId.toUpperCase()} (from ${data.senderNumber})`;
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "verifying", payment_ref: ref })
      .eq("id", o.id);
    if (error) throw new Error("Could not submit payment");
    return { ok: true as const, alreadyPaid: false };
  });
