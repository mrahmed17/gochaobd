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
    return { ok: true as const };
  });
