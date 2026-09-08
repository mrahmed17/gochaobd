import { auth, defineMcp } from "@lovable.dev/mcp-js";

import searchProducts from "./tools/search-products";
import getProduct from "./tools/get-product";
import listMyOrders from "./tools/list-my-orders";
import getMyOrder from "./tools/get-my-order";
import listWishlist from "./tools/list-wishlist";
import addToWishlist from "./tools/add-to-wishlist";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "gochaobd-home-organizer-hub",
  title: "GochaoBD: Home Organizer Hub",
  version: "0.1.0",
  instructions:
    "Tools for the GochaoBD storefront. Browse the catalog with search_products and get_product, and manage the signed-in customer's orders and wishlist with list_my_orders, get_my_order, list_wishlist and add_to_wishlist. Prices are in BDT.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchProducts, getProduct, listMyOrders, getMyOrder, listWishlist, addToWishlist],
});
