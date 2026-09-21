import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, Footer } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { categoriesQuery, productsQuery, storeBySlugQuery } from "@/lib/queries";

export const Route = createFileRoute("/store/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} store — GochaoBD` },
      { name: "description", content: `Shop the GochaoBD ${params.slug} collection with cash on delivery across Bangladesh.` },
      { property: "og:title", content: `GochaoBD ${params.slug} store` },
      { property: "og:description", content: `Products from the GochaoBD ${params.slug} brand.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: `https://gochaobd.lovable.app/store/${params.slug}` },
    ],
    links: [{ rel: "canonical", href: `https://gochaobd.lovable.app/store/${params.slug}` }],
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(storeBySlugQuery(params.slug)),
      context.queryClient.ensureQueryData(categoriesQuery(params.slug)),
      context.queryClient.ensureQueryData(productsQuery({ storeSlug: params.slug })),
    ]);
  },
  component: StorePage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive text-sm">Failed to load: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Store not found</div>,
});

function StorePage() {
  const { slug } = Route.useParams();
  const { data: store } = useSuspenseQuery(storeBySlugQuery(slug));
  const { data: cats } = useSuspenseQuery(categoriesQuery(slug));
  const { data: products } = useSuspenseQuery(productsQuery({ storeSlug: slug }));
  const [cat, setCat] = useState("all");

  if (!store) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-muted-foreground">
          This store doesn’t exist. <Link to="/stores" className="text-brand">See all brands</Link>
        </div>
      </AppShell>
    );
  }

  const filtered = products.filter((p) => cat === "all" || p.category_id === cats.find((c) => c.slug === cat)?.id);

  return (
    <AppShell>
      <div
        className="px-4 py-8 text-white"
        style={{ background: `linear-gradient(135deg, ${store.theme_color}, ${store.accent_color})` }}
      >
        <div className="mx-auto max-w-6xl">
          <Link to="/stores" className="text-xs opacity-80">← All brands</Link>
          <h1 className="mt-2 font-display text-3xl md:text-4xl">{store.name}</h1>
          <p className="text-sm opacity-90">{store.tagline}</p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {store.description && <p className="text-sm text-muted-foreground">{store.description}</p>}

        {cats.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
            <Chip active={cat === "all"} onClick={() => setCat("all")}>All</Chip>
            {cats.map((c) => (
              <Chip key={c.id} active={cat === c.slug} onClick={() => setCat(c.slug)}>{c.name}</Chip>
            ))}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>

        {!filtered.length && (
          <div className="mt-8 rounded-2xl border p-8 text-center text-sm text-muted-foreground">
            No products in this store yet — add them from the admin panel.
          </div>
        )}
      </div>
      <Footer />
    </AppShell>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm ${active ? "bg-foreground text-background border-foreground" : "bg-background hover:bg-muted"}`}>
      {children}
    </button>
  );
}
