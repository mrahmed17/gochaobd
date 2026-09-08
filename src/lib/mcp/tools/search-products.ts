import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "search_products",
  title: "Search products",
  description: "Search the GochaoBD catalog by keyword and return matching products with price and stock.",
  inputSchema: {
    query: z.string().trim().describe("Search keyword, e.g. 'kitchen rack'. Empty returns featured products."),
    limit: z.number().int().describe("Maximum number of products to return (1-50). Defaults to 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, limit }) => {
    const take = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const supabase = supabaseAnon();
    let q = supabase
      .from("products")
      .select("id, name, slug, price_bdt, compare_price_bdt, stock, rating, review_count, is_featured")
      .limit(take);
    if (query) q = q.ilike("name", `%${query}%`);
    else q = q.eq("is_featured", true);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { products: data ?? [] },
    };
  },
});
