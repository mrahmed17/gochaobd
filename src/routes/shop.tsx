import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell, Footer } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { categoriesQuery, productsQuery } from "@/lib/queries";
import { useState } from "react";

export const Route = createFileRoute("/shop")({
  head: () => ({
    meta: [
      { title: "Shop — GochaoBD" },
      {
        name: "description",
        content:
          "Browse all GochaoBD home organizers, kitchen accessories, storage solutions and smart home essentials.",
      },
      { property: "og:title", content: "Shop all — GochaoBD" },
      {
        property: "og:description",
        content: "Every GochaoBD product in one place. Filter by category, sort by price.",
      },
      { property: "og:url", content: "https://gochaobd.lovable.app/shop" },
    ],
    links: [{ rel: "canonical", href: "https://gochaobd.lovable.app/shop" }],
  }),
  component: ShopPage,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery()),
      context.queryClient.ensureQueryData(productsQuery()),
    ]);
  },
  errorComponent: ({ error }) => (
    <div className="p-6 text-destructive text-sm">Failed to load: {(error as Error).message}</div>
  ),
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function ShopPage() {
  const { data: cats } = useSuspenseQuery(categoriesQuery());
  const { data: products } = useSuspenseQuery(productsQuery());
  const [sort, setSort] = useState<"new" | "price-asc" | "price-desc">("new");
  const [cat, setCat] = useState<string>("all");

  const filtered = products
    .filter((p) => cat === "all" || p.category_id === cats.find((c) => c.slug === cat)?.id)
    .sort((a, b) => {
      if (sort === "price-asc") return a.price_bdt - b.price_bdt;
      if (sort === "price-desc") return b.price_bdt - a.price_bdt;
      return 0;
    });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-3xl md:text-4xl font-display">Shop all</h1>
        <p className="text-sm text-muted-foreground mt-1">{filtered.length} products</p>

        <div className="mt-4 flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>
            All
          </Chip>
          {cats.map((c) => (
            <Chip key={c.id} active={cat === c.slug} onClick={() => setCat(c.slug)}>
              {c.name}
            </Chip>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Showing {filtered.length}</div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="text-sm rounded-full border px-3 py-1.5 bg-background"
          >
            <option value="new">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </div>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
        {!filtered.length && (
          <div className="mt-8 rounded-2xl border p-8 text-center text-sm text-muted-foreground">
            No products found.{" "}
            <Link to="/shop" className="text-brand">
              Reset filters
            </Link>
          </div>
        )}
      </div>
      <Footer />
    </AppShell>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${active ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted"}`}
    >
      {children}
    </button>
  );
}
