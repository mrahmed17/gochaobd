import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell, Footer } from "@/components/AppShell";
import { categoriesQuery, resolveImage } from "@/lib/queries";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories — GochaoBD" }, { name: "description", content: "Browse categories: storage, kitchen, wardrobe organizers and smart home." }] }),
  component: CategoriesPage,
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQuery()),
  errorComponent: ({ error }) => <div className="p-6 text-destructive text-sm">Failed to load: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function CategoriesPage() {
  const { data } = useSuspenseQuery(categoriesQuery());
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-3xl md:text-4xl font-display">Categories</h1>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.map((c) => (
            <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} className="group flex items-center gap-4 rounded-2xl border p-3 bg-card hover:shadow-lift transition">
              <div className="h-20 w-20 shrink-0 rounded-xl overflow-hidden bg-muted">
                <img src={resolveImage(c.image_url)} alt={c.name} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-lg">{c.name}</div>
                <div className="text-xs text-muted-foreground">Shop the collection</div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </AppShell>
  );
}
