import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";

// Map DB image paths (/src/assets/x.jpg) → Vite asset URLs so <img src> resolves in prod.
const assetModules = import.meta.glob("/src/assets/*.{jpg,png,webp}", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

export function resolveImage(path: string | null | undefined): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return assetModules[path] ?? path;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  specs: string | null;
  price_bdt: number;
  compare_price_bdt: number | null;
  flash_price_bdt: number | null;
  stock: number;
  category_id: string | null;
  images: string[];
  video_url: string | null;
  is_featured: boolean;
  is_new: boolean;
  is_flash_sale: boolean;
  rating: number;
  review_count: number;
  delivery_days: string | null;
  cod_available: boolean;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
}

export const categoriesQuery = () =>
  queryOptions({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, image_url")
        .order("sort_order");
      if (error) throw error;
      return data as Category[];
    },
  });

export const productsQuery = (filter?: { categorySlug?: string; flash?: boolean; featured?: boolean; isNew?: boolean; search?: string }) =>
  queryOptions({
    queryKey: ["products", filter ?? {}],
    queryFn: async () => {
      let q = supabase.from("products").select("*");
      if (filter?.flash) q = q.eq("is_flash_sale", true);
      if (filter?.featured) q = q.eq("is_featured", true);
      if (filter?.isNew) q = q.eq("is_new", true);
      if (filter?.search) q = q.ilike("name", `%${filter.search}%`);
      if (filter?.categorySlug) {
        const { data: cat } = await supabase.from("categories").select("id").eq("slug", filter.categorySlug).maybeSingle();
        if (cat) q = q.eq("category_id", cat.id);
      }
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

export const productBySlugQuery = (slug: string) =>
  queryOptions({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("slug", slug).maybeSingle();
      if (error) throw error;
      return data as Product | null;
    },
  });

export const productsByIdsQuery = (ids: string[]) =>
  queryOptions({
    queryKey: ["products", "ids", ids.sort().join(",")],
    queryFn: async () => {
      if (!ids.length) return [];
      const { data, error } = await supabase.from("products").select("*").in("id", ids);
      if (error) throw error;
      return (data ?? []) as Product[];
    },
    enabled: ids.length > 0,
  });

export interface ProductVariant {
  id: string;
  product_id: string;
  option_group: string;
  label: string;
  price_delta_bdt: number;
  stock: number;
}

export const variantsQuery = (productId: string) =>
  queryOptions({
    queryKey: ["variants", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, product_id, option_group, label, price_delta_bdt, stock")
        .eq("product_id", productId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as ProductVariant[];
    },
  });

export interface Review {
  id: string;
  author_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export const reviewsQuery = (productId: string) =>
  queryOptions({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, author_name, rating, comment, created_at")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Review[];
    },
  });

/** Delivery zones & charges (free above 1500 BDT). */
export const DELIVERY_ZONES = [
  { value: "dhaka", label: "Inside Dhaka", fee: 60 },
  { value: "suburb", label: "Dhaka Suburb", fee: 100 },
  { value: "outside", label: "Outside Dhaka", fee: 130 },
] as const;

export const shippingFee = (zone: string, subtotal: number) =>
  subtotal >= 1500 ? 0 : (DELIVERY_ZONES.find((z) => z.value === zone)?.fee ?? 130);
