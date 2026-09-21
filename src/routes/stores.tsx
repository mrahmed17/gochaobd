import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell, Footer } from "@/components/AppShell";
import { storesQuery } from "@/lib/queries";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/stores")({
  head: () => ({
    meta: [
      { title: "Our brands — GochaoBD" },
      { name: "description", content: "Explore every GochaoBD brand: home organizers, baby, beauty, kitchen, fashion, plants and pet care — one account, one checkout." },
      { property: "og:title", content: "All GochaoBD brands" },
      { property: "og:description", content: "Home, Baby, Beauty, Kitchen, Fashion, Plant and Pet stores under one roof." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://gochaobd.lovable.app/stores" },
    ],
    links: [{ rel: "canonical", href: "https://gochaobd.lovable.app/stores" }],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(storesQuery());
  },
  component: StoresPage,
  errorComponent: ({ error }) => <div className="p-6 text-destructive text-sm">Failed to load: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function StoresPage() {
  const { data: stores } = useSuspenseQuery(storesQuery());

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-3xl md:text-4xl font-display">Our brands</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every brand shares one cart, one account and one delivery network.
        </p>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stores.map((s) => (
            <Link
              key={s.id}
              to="/store/$slug"
              params={{ slug: s.slug }}
              className="group rounded-2xl border bg-card p-5 hover:shadow-lg transition-shadow"
            >
              <div
                className="h-10 w-10 rounded-xl"
                style={{ background: `linear-gradient(135deg, ${s.theme_color}, ${s.accent_color})` }}
              />
              <h2 className="mt-3 font-display text-xl">{s.name}</h2>
              <p className="text-sm text-muted-foreground">{s.tagline}</p>
              {s.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
              <span className="mt-3 inline-flex items-center gap-1 text-sm text-brand">
                Visit store <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </Link>
          ))}
        </div>
      </div>
      <Footer />
    </AppShell>
  );
}
