import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "get_product",
  title: "Get product details",
  description: "Fetch full details and variants for one GochaoBD product by its slug.",
  inputSchema: { slug: z.string().trim().describe("Product slug, e.g. 'bamboo-spice-rack'.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    const supabase = supabaseAnon();
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, slug, description, specs, price_bdt, compare_price_bdt, flash_price_bdt, stock, rating, review_count, delivery_days, cod_available, images",
      )
      .eq("slug", slug)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data)
      return {
        content: [{ type: "text", text: `No product found with slug '${slug}'.` }],
        isError: true,
      };
    const { data: variants } = await supabase
      .from("product_variants")
      .select("id, label, price_bdt, stock")
      .eq("product_id", data.id);
    const product = { ...data, variants: variants ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(product) }],
      structuredContent: { product },
    };
  },
});
