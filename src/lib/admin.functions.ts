import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-side admin gate: verifies the caller's role from user_roles using the
 * authenticated (RLS-scoped) client, never trusting client-side checks.
 */
async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!roles?.some((r: any) => r.role === "admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
}

export const verifyAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    return { ok: true as const };
  });

export const getAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: orders }, { data: products }, { data: coupons }] = await Promise.all([
      supabaseAdmin.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("products").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("coupons").select("*"),
    ]);
    return { orders: orders ?? [], products: products ?? [], coupons: coupons ?? [] };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled"]) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("orders").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateProductStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid(), stock: z.number().int().min(0).max(100000) }).parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("products").update({ stock: data.stock }).eq("id", data.id);
    if (error) throw new Error(error.message);

    // Auto restock notifications: anyone waiting for this product gets queued a message.
    let notified = 0;
    if (data.stock > 0) {
      const { data: alerts } = await supabaseAdmin
        .from("stock_alerts").select("*").eq("product_id", data.id).eq("notified", false);
      if (alerts?.length) {
        const { data: product } = await supabaseAdmin
          .from("products").select("name, slug").eq("id", data.id).maybeSingle();
        await supabaseAdmin.from("notifications").insert(
          alerts.map((a: any) => ({
            channel: a.email ? "email" : "sms",
            recipient: a.email ?? a.phone,
            subject: `${product?.name ?? "Your product"} is back in stock`,
            body: `Good news! ${product?.name ?? "The item"} is available again at GochaoBD. Order now: /product/${product?.slug ?? ""}`,
          })),
        );
        await supabaseAdmin.from("stock_alerts").update({ notified: true }).eq("product_id", data.id).eq("notified", false);
        notified = alerts.length;
      }
    }
    return { ok: true as const, notified };
  });

/* ---------------- Catalog management ---------------- */

const productInput = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(2).max(80),
  name: z.string().min(2).max(160),
  description: z.string().max(4000).nullable().optional(),
  specs: z.string().max(4000).nullable().optional(),
  price_bdt: z.number().int().min(0).max(10000000),
  compare_price_bdt: z.number().int().min(0).max(10000000).nullable().optional(),
  stock: z.number().int().min(0).max(100000),
  category_id: z.string().uuid().nullable().optional(),
  images: z.array(z.string().max(500)).max(8).optional(),
  video_url: z.string().max(500).nullable().optional(),
  is_featured: z.boolean().optional(),
  is_new: z.boolean().optional(),
  is_flash_sale: z.boolean().optional(),
  flash_price_bdt: z.number().int().min(0).max(10000000).nullable().optional(),
});

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => productInput.parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...fields } = data;
    if (id) {
      const { error } = await supabaseAdmin.from("products").update(fields).eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true as const, id };
    }
    const { data: row, error } = await supabaseAdmin.from("products").insert(fields).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true as const, id: row.id };
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("products").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      slug: z.string().min(2).max(60),
      name: z.string().min(2).max(80),
      image_url: z.string().max(500).nullable().optional(),
      sort_order: z.number().int().min(0).max(999).optional(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...fields } = data;
    const q = id
      ? supabaseAdmin.from("categories").update(fields).eq("id", id)
      : supabaseAdmin.from("categories").insert(fields);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const saveCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      code: z.string().min(2).max(30),
      discount_type: z.enum(["percent", "flat"]),
      discount_value: z.number().int().min(0).max(100000),
      min_order_bdt: z.number().int().min(0).max(1000000),
      active: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("coupons")
      .upsert({ ...data, code: data.code.toUpperCase() }, { onConflict: "code" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCoupon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().max(30) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("coupons").delete().eq("code", data.code);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------------- Variants ---------------- */

export const saveVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid().optional(),
      product_id: z.string().uuid(),
      option_group: z.string().min(1).max(40),
      label: z.string().min(1).max(60),
      price_delta_bdt: z.number().int().min(-1000000).max(1000000),
      stock: z.number().int().min(0).max(100000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...fields } = data;
    const q = id
      ? supabaseAdmin.from("product_variants").update(fields).eq("id", id)
      : supabaseAdmin.from("product_variants").insert(fields);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteVariant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_variants").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const listVariants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("product_variants").select("*").eq("product_id", data.productId).order("sort_order");
    return rows ?? [];
  });

/* ---------------- Marketing: stock alerts & abandoned carts ---------------- */

export const getMarketingData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: alerts }, { data: carts }, { data: notes }, { data: categories }] = await Promise.all([
      supabaseAdmin.from("stock_alerts").select("*, products(name, slug, stock)").order("created_at", { ascending: false }).limit(100),
      supabaseAdmin.from("abandoned_carts").select("*").eq("recovered", false).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("notifications").select("*").order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("categories").select("*").order("sort_order"),
    ]);
    return { alerts: alerts ?? [], carts: carts ?? [], notifications: notes ?? [], categories: categories ?? [] };
  });

/** Queue restock notifications for everyone waiting on a product that is back in stock. */
export const notifyRestock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product } = await supabaseAdmin
      .from("products").select("id, name, slug, stock").eq("id", data.productId).maybeSingle();
    if (!product || product.stock <= 0) return { sent: 0 };
    const { data: alerts } = await supabaseAdmin
      .from("stock_alerts").select("*").eq("product_id", data.productId).eq("notified", false);
    if (!alerts?.length) return { sent: 0 };
    await supabaseAdmin.from("notifications").insert(
      alerts.map((a: any) => ({
        channel: a.email ? "email" : "sms",
        recipient: a.email ?? a.phone,
        subject: `${product.name} is back in stock`,
        body: `Good news! ${product.name} is available again at GochaoBD. Order now: /product/${product.slug}`,
      })),
    );
    await supabaseAdmin.from("stock_alerts").update({ notified: true }).eq("product_id", data.productId).eq("notified", false);
    return { sent: alerts.length };
  });

/** Queue a recovery reminder for an abandoned cart. */
export const sendCartReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cart } = await supabaseAdmin.from("abandoned_carts").select("*").eq("id", data.id).maybeSingle();
    if (!cart?.contact) throw new Error("No contact for this cart");
    await supabaseAdmin.from("notifications").insert({
      channel: cart.contact.includes("@") ? "email" : "sms",
      recipient: cart.contact,
      subject: "You left something behind 🛒",
      body: `Your GochaoBD cart worth ৳${cart.subtotal_bdt} is still waiting. Complete your order today!`,
    });
    await supabaseAdmin.from("abandoned_carts").update({ recovered: true }).eq("id", data.id);
    return { ok: true as const };
  });
