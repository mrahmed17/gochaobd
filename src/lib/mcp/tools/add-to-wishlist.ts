import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { notAuthenticated, supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_to_wishlist",
  title: "Add product to wishlist",
  description: "Save a product to the signed-in customer's GochaoBD wishlist, by product slug.",
  inputSchema: {
    slug: z.string().trim().describe("Product slug to save, e.g. 'bamboo-spice-rack'."),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: async ({ slug }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name")
      .eq("slug", slug)
      .maybeSingle();
    if (pErr) return { content: [{ type: "text", text: pErr.message }], isError: true };
    if (!product)
      return {
        content: [{ type: "text", text: `No product found with slug '${slug}'.` }],
        isError: true,
      };
    const { error } = await supabase
      .from("wishlists")
      .upsert(
        { user_id: ctx.getUserId()!, product_id: product.id },
        { onConflict: "user_id,product_id" },
      );
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Saved "${product.name}" to your wishlist.` }],
      structuredContent: { saved: true, product_id: product.id },
    };
  },
});
