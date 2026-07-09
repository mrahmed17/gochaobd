import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell, Footer } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { categoriesQuery, productsQuery } from "@/lib/queries";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params, loaderData }) => {
    const cat = (loaderData as { cat: { name: string; slug: string } } | undefined)?.cat;
    const name = cat?.name ?? params.slug;
    const url = `https://gochaobd.lovable.app/category/${params.slug}`;
    const desc = `Shop ${name} at GochaoBD — affordable home organizers with cash on delivery across Bangladesh.`;
    return {
      meta: [
        { title: `${name} — GochaoBD` },
        { name: "description", content: desc },
        { property: "og:title", content: `${name} — GochaoBD` },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name,
            url,
            description: desc,
          }),
        },
      ],
    };
  },
  component: CategoryPage,
  loader: async ({ context, params }) => {
    const cats = await context.queryClient.ensureQueryData(categoriesQuery());
    const cat = cats.find((c) => c.slug === params.slug);
    if (!cat) throw notFound();
    await context.queryClient.ensureQueryData(productsQuery({ categorySlug: params.slug }));
    return { cat };
  },
  errorComponent: ({ error }) => <div className="p-6 text-destructive text-sm">Failed to load: {error.message}</div>,
  notFoundComponent: () => (
    <AppShell><div className="p-8 text-center"><h1 className="font-display text-2xl">Category not found</h1><Link to="/categories" className="text-brand text-sm">Back to categories</Link></div></AppShell>
  ),
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { cat } = Route.useLoaderData();
  const { data: products } = useSuspenseQuery(productsQuery({ categorySlug: slug }));
  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <nav className="text-xs text-muted-foreground"><Link to="/categories">Categories</Link> / {cat.name}</nav>
        <h1 className="mt-2 text-3xl md:text-4xl font-display">{cat.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{products.length} products</p>
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </div>
      <Footer />
    </AppShell>
  );
}
