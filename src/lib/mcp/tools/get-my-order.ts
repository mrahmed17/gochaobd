import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_my_order",
  title: "Get my order",
  description: "Fetch one of the signed-in customer's orders, including its items, by order number.",
  inputSchema: { order_number: z.string().trim().describe("The order number, e.g. 'GCB-10231'.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ order_number }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_number, status, payment_status, payment_method, subtotal_bdt, shipping_bdt, discount_bdt, total_bdt, delivery_zone, city, district, address_line, created_at")
      .eq("order_number", order_number)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: `No order '${order_number}' found on your account.` }], isError: true };
    const { data: items } = await supabase
      .from("order_items")
      .select("product_name, variant_label, qty, unit_price_bdt")
      .eq("order_id", data.id);
    const order = { ...data, items: items ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(order) }],
      structuredContent: { order },
    };
  },
});
