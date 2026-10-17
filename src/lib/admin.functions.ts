import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TablesUpdate } from "@/integrations/supabase/types";

/**
 * Server-side admin gate: verifies the caller's role from user_roles using the
 * authenticated (RLS-scoped) client, never trusting client-side checks.
 */
async function assertAdmin(supabase: any, userId: string) {
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (!roles?.some((r: any) => r.role === "admin")) {
    throw new Response("Forbidden", { status: 403 });
  }
  // Session revocation stamp: once cleared from the customers tab, this
  // account loses EVERY server-side admin action immediately, even while its
  // access token is still valid (Supabase cannot revoke another user's
  // refresh tokens by id, so we enforce it at our own choke point).
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
  const meta = (u?.user?.app_metadata ?? {}) as { auth_revoked_at?: string };
  if (meta.auth_revoked_at) throw new Response("Session revoked", { status: 401 });
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
    const [{ data: orders }, { data: products }, { data: coupons }, { data: stores }] =
      await Promise.all([
        supabaseAdmin
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin.from("products").select("*").order("created_at", { ascending: false }),
        supabaseAdmin.from("coupons").select("*"),
        supabaseAdmin.from("stores").select("*").order("sort_order"),
      ]);
    return {
      orders: orders ?? [],
      products: products ?? [],
      coupons: coupons ?? [],
      stores: stores ?? [],
    };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("orders")
      .select("customer_phone, status")
      .eq("id", data.id)
      .maybeSingle();
    const patch: TablesUpdate<"orders"> = { status: data.status };
    if (data.status === "shipped") patch.shipped_at = new Date().toISOString();
    if (data.status === "delivered") patch.delivered_at = new Date().toISOString();
    const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    // Fraud memory: every return/cancel teaches the phone-risk score used at
    // checkout and warned in the dispatch panel.
    if (
      prev &&
      prev.status !== data.status &&
      (data.status === "returned" || data.status === "cancelled")
    ) {
      const { normalizeBdPhone } = await import("@/lib/sms.functions");
      const phone = normalizeBdPhone(prev.customer_phone ?? "");
      if (phone) {
        const { data: row } = await supabaseAdmin
          .from("phone_risk")
          .select("returned_count, cancelled_count")
          .eq("phone", phone)
          .maybeSingle();
        if (row) {
          const patch =
            data.status === "returned"
              ? { returned_count: row.returned_count + 1, updated_at: new Date().toISOString() }
              : { cancelled_count: row.cancelled_count + 1, updated_at: new Date().toISOString() };
          await supabaseAdmin.from("phone_risk").update(patch).eq("phone", phone);
        } else {
          await supabaseAdmin.from("phone_risk").insert({
            phone,
            returned_count: data.status === "returned" ? 1 : 0,
            cancelled_count: data.status === "cancelled" ? 1 : 0,
          });
        }
      }
    }
    return { ok: true as const };
  });

/** Bulk status change (e.g. 50 pending orders → confirmed in one click). */
export const bulkUpdateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(100),
        status: z.enum(["pending", "confirmed", "shipped", "delivered", "cancelled", "returned"]),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: TablesUpdate<"orders"> = { status: data.status };
    if (data.status === "shipped") patch.shipped_at = new Date().toISOString();
    if (data.status === "delivered") patch.delivered_at = new Date().toISOString();
    const { error, data: updated } = await supabaseAdmin
      .from("orders")
      .update(patch)
      .in("id", data.ids)
      .select("id");
    if (error) throw new Error(error.message);
    return { ok: true as const, updated: updated?.length ?? 0 };
  });

export const updatePaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ id: z.string().uuid(), payment_status: z.enum(["paid", "failed", "awaiting"]) })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: TablesUpdate<"orders"> = { payment_status: data.payment_status };
    if (data.payment_status === "paid") patch.status = "confirmed";
    const { error } = await supabaseAdmin.from("orders").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateProductStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), stock: z.number().int().min(0).max(100000) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("products")
      .update({ stock: data.stock })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // Auto restock notifications: anyone waiting for this product gets queued a message.
    let notified = 0;
    if (data.stock > 0) {
      const { data: alerts } = await supabaseAdmin
        .from("stock_alerts")
        .select("*")
        .eq("product_id", data.id)
        .eq("notified", false);
      if (alerts?.length) {
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("name, slug")
          .eq("id", data.id)
          .maybeSingle();
        await supabaseAdmin.from("notifications").insert(
          alerts.map((a: any) => ({
            channel: a.email ? "email" : "sms",
            recipient: a.email ?? a.phone,
            subject: `${product?.name ?? "Your product"} is back in stock`,
            body: `Good news! ${product?.name ?? "The item"} is available again at GochaoBD. Order now: /product/${product?.slug ?? ""}`,
          })),
        );
        await supabaseAdmin
          .from("stock_alerts")
          .update({ notified: true })
          .eq("product_id", data.id)
          .eq("notified", false);
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
  store_id: z.string().uuid().nullable().optional(),
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
    const { data: row, error } = await supabaseAdmin
      .from("products")
      .insert(fields)
      .select("id")
      .single();
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
    z
      .object({
        id: z.string().uuid().optional(),
        slug: z.string().min(2).max(60),
        name: z.string().min(2).max(80),
        image_url: z.string().max(500).nullable().optional(),
        sort_order: z.number().int().min(0).max(999).optional(),
        store_id: z.string().uuid().nullable().optional(),
      })
      .parse(d),
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
    z
      .object({
        code: z.string().min(2).max(30),
        discount_type: z.enum(["percent", "flat"]),
        discount_value: z.number().int().min(0).max(100000),
        min_order_bdt: z.number().int().min(0).max(1000000),
        active: z.boolean(),
      })
      .parse(d),
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
    z
      .object({
        id: z.string().uuid().optional(),
        product_id: z.string().uuid(),
        option_group: z.string().min(1).max(40),
        label: z.string().min(1).max(60),
        price_delta_bdt: z.number().int().min(-1000000).max(1000000),
        stock: z.number().int().min(0).max(100000),
      })
      .parse(d),
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
      .from("product_variants")
      .select("*")
      .eq("product_id", data.productId)
      .order("sort_order");
    return rows ?? [];
  });

/* ---------------- Marketing: stock alerts & abandoned carts ---------------- */

export const getMarketingData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: alerts }, { data: carts }, { data: notes }, { data: categories }] =
      await Promise.all([
        supabaseAdmin
          .from("stock_alerts")
          .select("*, products(name, slug, stock)")
          .order("created_at", { ascending: false })
          .limit(100),
        supabaseAdmin
          .from("abandoned_carts")
          .select("*")
          .eq("recovered", false)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("notifications")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin.from("categories").select("*").order("sort_order"),
      ]);
    return {
      alerts: alerts ?? [],
      carts: carts ?? [],
      notifications: notes ?? [],
      categories: categories ?? [],
    };
  });

/* ---------------- Bundle deals (frequently bought together) ---------------- */

export const getBundles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("product_bundles")
      .select("id, product_id, with_product_id, discount_bdt, active, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const saveBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        productId: z.string().uuid(),
        withProductId: z.string().uuid(),
        discountBdt: z.number().int().min(0).max(100000),
        active: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.productId === data.withProductId)
      throw new Error("দুটি আলাদা প্রোডাক্ট নির্বাচন করুন");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_bundles").upsert(
      {
        ...(data.id ? { id: data.id } : {}),
        product_id: data.productId,
        with_product_id: data.withProductId,
        discount_bdt: data.discountBdt,
        active: data.active,
      },
      { onConflict: "product_id,with_product_id" },
    );
    if (error)
      throw new Error(error.code === "23505" ? "এই প্রোডাক্ট পেয়ার আগে থেকেই আছে" : error.message);
    return { ok: true as const };
  });

export const deleteBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("product_bundles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Queue restock notifications for everyone waiting on a product that is back in stock. */
export const notifyRestock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id, name, slug, stock")
      .eq("id", data.productId)
      .maybeSingle();
    if (!product || product.stock <= 0) return { sent: 0 };
    const { data: alerts } = await supabaseAdmin
      .from("stock_alerts")
      .select("*")
      .eq("product_id", data.productId)
      .eq("notified", false);
    if (!alerts?.length) return { sent: 0 };
    await supabaseAdmin.from("notifications").insert(
      alerts.map((a: any) => ({
        channel: a.email ? "email" : "sms",
        recipient: a.email ?? a.phone,
        subject: `${product.name} is back in stock`,
        body: `Good news! ${product.name} is available again at GochaoBD. Order now: /product/${product.slug}`,
      })),
    );
    await supabaseAdmin
      .from("stock_alerts")
      .update({ notified: true })
      .eq("product_id", data.productId)
      .eq("notified", false);
    return { sent: alerts.length };
  });

/** Queue a recovery reminder for an abandoned cart. */
export const sendCartReminder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cart } = await supabaseAdmin
      .from("abandoned_carts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
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

/* ---------------- Stores (multi-brand) ---------------- */

export const saveStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid().optional(),
        slug: z
          .string()
          .min(2)
          .max(40)
          .regex(/^[a-z0-9-]+$/),
        name: z.string().min(2).max(80),
        tagline: z.string().max(160).nullable().optional(),
        description: z.string().max(2000).nullable().optional(),
        theme_color: z.string().max(20),
        accent_color: z.string().max(20),
        logo_url: z.string().max(500).nullable().optional(),
        active: z.boolean(),
        sort_order: z.number().int().min(0).max(999).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...fields } = data;
    const q = id
      ? supabaseAdmin.from("stores").update(fields).eq("id", id)
      : supabaseAdmin.from("stores").insert(fields);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteStore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: store } = await supabaseAdmin
      .from("stores")
      .select("slug")
      .eq("id", data.id)
      .maybeSingle();
    if (store?.slug === "home") throw new Error("The main Home store cannot be deleted");
    const { error } = await supabaseAdmin.from("stores").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------------- Customers, reviews, order details ---------------- */

export const getCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: list }, { data: profiles }, { data: roles }, { data: orders }] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ perPage: 500 }),
        supabaseAdmin.from("profiles").select("user_id, full_name, phone"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
        supabaseAdmin.from("orders").select("user_id, total_bdt"),
      ]);
    return (list?.users ?? []).map((u) => {
      const p = profiles?.find((x) => x.user_id === u.id);
      const mine = orders?.filter((o) => o.user_id === u.id) ?? [];
      return {
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        full_name: p?.full_name ?? null,
        phone: p?.phone ?? null,
        is_admin: !!roles?.some((r) => r.user_id === u.id && r.role === "admin"),
        sessions_revoked: !!((u.app_metadata ?? {}) as { auth_revoked_at?: string })
          .auth_revoked_at,
        order_count: mine.length,
        spent_bdt: mine.reduce((s, o) => s + o.total_bdt, 0),
      };
    });
  });

export const setAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), admin: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.admin)
      throw new Error("You cannot remove your own admin access");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = data.admin
      ? await supabaseAdmin
          .from("user_roles")
          .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" })
      : await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", data.userId)
          .eq("role", "admin");
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("reviews")
      .select("id, author_name, rating, comment, created_at, products(name, slug)")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin
      .from("reviews")
      .select("product_id")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("reviews").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (r?.product_id) {
      const { data: rest } = await supabaseAdmin
        .from("reviews")
        .select("rating")
        .eq("product_id", r.product_id);
      const n = rest?.length ?? 0;
      const avg = n ? Math.round((rest!.reduce((s, x) => s + x.rating, 0) / n) * 10) / 10 : 0;
      await supabaseAdmin
        .from("products")
        .update({ rating: avg, review_count: n })
        .eq("id", r.product_id);
    }
    return { ok: true as const };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("products").update({ category_id: null }).eq("category_id", data.id);
    const { error } = await supabaseAdmin.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const getOrderItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ orderId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("order_items")
      .select("id, product_name, variant_label, unit_price_bdt, qty")
      .eq("order_id", data.orderId);
    return rows ?? [];
  });

/* ---------------- Courier fraud score (phone risk) ---------------- */

export const getPhoneRisk = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("phone_risk")
      .select("phone, returned_count, cancelled_count, order_count, blocked, note, updated_at")
      .order("returned_count", { ascending: false })
      .order("cancelled_count", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const setPhoneRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        phone: z.string().regex(/^01[3-9]\d{8}$/),
        blocked: z.boolean().optional(),
        note: z.string().max(200).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.blocked !== undefined) patch.blocked = data.blocked;
    if (data.note !== undefined) patch.note = data.note;
    const { error } = await supabaseAdmin
      .from("phone_risk")
      .upsert(
        { phone: data.phone, returned_count: 0, cancelled_count: 0, order_count: 0, ...patch },
        { onConflict: "phone" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ---------------- Session revocation (admin kick) ---------------- */

/**
 * Revoke or restore an account's server-side access.
 *
 * Supabase's admin API can only revoke refresh tokens when handed the user's
 * own JWT — there is no revoke-by-user-id endpoint — so an admin kick is
 * enforced at our choke point: assertAdmin() (and every token-checked server
 * function) refuses an account carrying this stamp. Combine with a password
 * reset when the account may be compromised.
 */
export const setUserSessionRevoked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), revoked: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: gErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (gErr || !u.user) throw new Error("User not found");
    // GoTrue replaces app_metadata wholesale, so spread what already exists.
    const meta = { ...(u.user.app_metadata ?? {}) } as Record<string, unknown>;
    if (data.revoked) meta.auth_revoked_at = new Date().toISOString();
    else delete meta.auth_revoked_at;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      app_metadata: meta,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const, revoked: data.revoked };
  });
