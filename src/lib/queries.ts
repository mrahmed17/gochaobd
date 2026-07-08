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
