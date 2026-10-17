import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_orders",
  title: "List my orders",
  description:
    "List the signed-in customer's GochaoBD orders with status and totals, newest first.",
  inputSchema: {
    limit: z.number().int().describe("Maximum number of orders to return (1-50). Defaults to 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const take = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("orders")
      .select("order_number, status, payment_status, payment_method, total_bdt, created_at")
      .order("created_at", { ascending: false })
      .limit(take);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { orders: data ?? [] },
    };
  },
});
