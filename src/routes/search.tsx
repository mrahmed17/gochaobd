import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, Footer } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { productsQuery } from "@/lib/queries";
import { Search as SearchIcon } from "lucide-react";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "Search — GochaoBD" }] }),
  component: SearchPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery()),
  errorComponent: ({ error }) => <div className="p-6 text-destructive text-sm">Failed: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function SearchPage() {
  const { data } = useSuspenseQuery(productsQuery());
  const [q, setQ] = useState("");
  const results = q ? data.filter((p) => (p.name + " " + (p.description ?? "")).toLowerCase().includes(q.toLowerCase())) : data;
  const popular = ["spice jar", "drawer organizer", "shoe rack", "motion light"];
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-6">
        <label className="flex items-center gap-3 rounded-full border bg-background px-4 py-3">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products, categories…" className="flex-1 bg-transparent outline-none text-sm" />
        </label>
        {!q && (
          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-2">Popular searches</div>
            <div className="flex flex-wrap gap-2">
              {popular.map((t) => <button key={t} onClick={() => setQ(t)} className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted">{t}</button>)}
            </div>
          </div>
        )}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          {results.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
        {!results.length && <div className="mt-8 text-center text-sm text-muted-foreground">No matches. <Link to="/shop" className="text-brand">Browse all</Link></div>}
      </div>
      <Footer />
    </AppShell>
  );
}
