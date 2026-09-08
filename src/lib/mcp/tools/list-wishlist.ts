import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_wishlist",
  title: "List my wishlist",
  description: "List the products saved to the signed-in customer's GochaoBD wishlist.",
  inputSchema: { limit: z.number().int().describe("Maximum number of items to return (1-100). Defaults to 25.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const take = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("wishlists")
      .select("created_at, products(name, slug, price_bdt, stock)")
      .order("created_at", { ascending: false })
      .limit(take);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { items: data ?? [] },
    };
  },
});
