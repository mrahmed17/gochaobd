import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, Footer } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { productBySlugQuery, productsQuery, resolveImage } from "@/lib/queries";
import { bdt } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { Star, Truck, ShieldCheck, CheckCircle2, Heart, Minus, Plus, Package } from "lucide-react";

export const Route = createFileRoute("/product/$slug")({
  head: ({ params, loaderData }) => {
    const p = (loaderData as { product: { name: string; description: string | null; images: string[]; price_bdt: number; stock: number; rating: number; review_count: number } } | undefined)?.product;
    const url = `https://gochaobd.lovable.app/product/${params.slug}`;
    if (!p) return { meta: [{ title: "Product — GochaoBD" }], links: [{ rel: "canonical", href: url }] };
    const img = resolveImage(p.images[0]);
    const desc = (p.description ?? `${p.name} — available at GochaoBD with cash on delivery across Bangladesh.`).slice(0, 160);
    return {
      meta: [
        { title: `${p.name} — GochaoBD` },
        { name: "description", content: desc },
        { property: "og:title", content: p.name },
        { property: "og:description", content: desc },
        { property: "og:image", content: img },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: p.name,
            image: img,
            description: p.description ?? undefined,
            aggregateRating: p.review_count > 0 ? { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.review_count } : undefined,
            offers: {
              "@type": "Offer",
              price: p.price_bdt,
              priceCurrency: "BDT",
              availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
              url,
            },
          }),
        },
      ],
    };
  },
  component: ProductPage,
  loader: async ({ context, params }) => {
    const product = await context.queryClient.ensureQueryData(productBySlugQuery(params.slug));
    if (!product) throw notFound();
    await context.queryClient.ensureQueryData(productsQuery());
    return { product };
  },
  errorComponent: ({ error }) => <div className="p-6 text-destructive text-sm">Failed to load: {error.message}</div>,
  notFoundComponent: () => (
    <AppShell><div className="p-8 text-center"><h1 className="font-display text-2xl">Product not found</h1><Link to="/shop" className="text-brand text-sm">Continue shopping</Link></div></AppShell>
  ),
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: product } = useSuspenseQuery(productBySlugQuery(slug));
  const { data: all } = useSuspenseQuery(productsQuery());
  if (!product) return null;
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const price = product.is_flash_sale && product.flash_price_bdt ? product.flash_price_bdt : product.price_bdt;
  const related = all.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const fbt = all.filter((p) => p.id !== product.id).slice(0, 2);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-4">
        <nav className="text-xs text-muted-foreground mb-3"><Link to="/shop">Shop</Link> / <span className="text-foreground">{product.name}</span></nav>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="rounded-3xl overflow-hidden bg-muted border aspect-square">
              <img src={resolveImage(product.images[0])} alt={product.name} className="h-full w-full object-cover" />
            </div>
            {product.video_url && (
              <video controls src={product.video_url} className="mt-2 rounded-2xl w-full" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs">
              {product.stock > 0 ? (
                <span className="inline-flex items-center gap-1 text-brand font-medium"><CheckCircle2 className="h-3 w-3" /> In stock ({product.stock})</span>
              ) : (
                <span className="text-destructive font-medium">Out of stock</span>
              )}
            </div>
            <h1 className="mt-1 text-2xl md:text-3xl font-display">{product.name}</h1>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Star className="h-4 w-4 fill-accent-orange text-accent-orange" />
              <span className="font-medium">{product.rating}</span>
              <span className="text-muted-foreground">· {product.review_count} reviews</span>
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-3xl font-display">{bdt(price)}</span>
              {product.compare_price_bdt && product.compare_price_bdt > price && (
                <span className="text-muted-foreground line-through">{bdt(product.compare_price_bdt)}</span>
              )}
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2"><Truck className="h-4 w-4 text-brand" /> Delivery in {product.delivery_days ?? "2–5 days"}</div>
              {product.cod_available && <div className="flex items-center gap-2"><Package className="h-4 w-4 text-brand" /> Cash on Delivery available</div>}
              <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand" /> 7-day easy returns</div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <div className="inline-flex items-center rounded-full border">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-11 w-11 grid place-items-center" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
                <span className="w-10 text-center font-medium" aria-live="polite">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} className="h-11 w-11 grid place-items-center" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
              </div>
              <button
                onClick={() => cart.add({ id: product.id, slug: product.slug, name: product.name, price, image: product.images[0] }, qty)}
                className="flex-1 rounded-full bg-brand text-brand-foreground py-3 text-sm font-medium btn-glow"
              >
                Add to cart
              </button>
              <button onClick={() => cart.toggleWish(product.id)} className="h-12 w-12 grid place-items-center rounded-full border" aria-label={cart.inWishlist(product.id) ? "Remove from wishlist" : "Add to wishlist"}>
                <Heart className={`h-5 w-5 ${cart.inWishlist(product.id) ? "fill-accent-orange text-accent-orange" : ""}`} />
              </button>
            </div>

            {product.description && (
              <details open className="mt-6 border-t pt-4">
                <summary className="font-semibold cursor-pointer">Description</summary>
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{product.description}</p>
              </details>
            )}
            {product.specs && (
              <details className="mt-3 border-t pt-4">
                <summary className="font-semibold cursor-pointer">Specifications</summary>
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{product.specs}</p>
              </details>
            )}
          </div>
        </div>

        {fbt.length > 0 && (
          <section className="mt-10 rounded-3xl border p-5">
            <h2 className="font-display text-xl">Frequently bought together</h2>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
              <div><ProductCard product={product} /></div>
              {fbt.map((p) => <div key={p.id}><ProductCard product={p} /></div>)}
              <button
                onClick={() => {
                  [product, ...fbt].forEach((p) => cart.add({ id: p.id, slug: p.slug, name: p.name, price: p.price_bdt, image: p.images[0] }));
                }}
                className="md:col-span-1 rounded-2xl bg-accent-orange text-accent-orange-foreground py-4 text-sm font-medium"
              >
                Add bundle
              </button>
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-xl md:text-2xl">You may also like</h2>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {related.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          </section>
        )}
      </div>
      <Footer />
    </AppShell>
  );
}
