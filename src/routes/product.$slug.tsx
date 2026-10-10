import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, Footer } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { productBySlugQuery, productsQuery, resolveImage, variantsQuery, reviewsQuery } from "@/lib/queries";
import { bdt } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Star, Truck, ShieldCheck, CheckCircle2, Heart, Minus, Plus, Package, BellRing, Zap } from "lucide-react";
import { QuickCheckout } from "@/components/QuickCheckout";


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
  errorComponent: ({ error }) => <div className="p-6 text-destructive text-sm">Failed to load: {(error as Error).message}</div>,
  notFoundComponent: () => (
    <AppShell><div className="p-8 text-center"><h1 className="font-display text-2xl">Product not found</h1><Link to="/shop" className="text-brand text-sm">Continue shopping</Link></div></AppShell>
  ),
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: product } = useSuspenseQuery(productBySlugQuery(slug));
  const { data: all } = useSuspenseQuery(productsQuery());
  const cart = useCart();
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [variant, setVariant] = useState<string | null>(null);
  const [quick, setQuick] = useState(false);
  const { data: variants = [] } = useQuery({ ...variantsQuery(product?.id ?? ""), enabled: !!product });
  if (!product) return null;
  const chosen = variants.find((v) => v.label === variant) ?? null;
  const base = product.is_flash_sale && product.flash_price_bdt ? product.flash_price_bdt : product.price_bdt;
  const price = base + (chosen?.price_delta_bdt ?? 0);
  const stock = chosen ? chosen.stock : product.stock;
  const related = all.filter((p) => p.id !== product.id && p.category_id === product.category_id).slice(0, 4);
  const fbt = all.filter((p) => p.id !== product.id).slice(0, 2);
  const images = product.images.length ? product.images : [""];

  function addToCart() {
    if (variants.length && !variant) { toast.error("Please select an option"); return; }
    if (stock <= 0) { toast.error("Out of stock"); return; }
    cart.add({ id: product!.id, slug: product!.slug, name: product!.name, price, image: images[imgIdx] ?? images[0], variant }, qty);
  }
  function buyNow() {
    if (variants.length && !variant) { toast.error("Please select an option"); return; }
    if (stock <= 0) { toast.error("Out of stock"); return; }
    setQuick(true);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-4">
        <nav className="text-xs text-muted-foreground mb-3"><Link to="/shop">Shop</Link> / <span className="text-foreground">{product.name}</span></nav>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <div className="rounded-3xl overflow-hidden bg-muted border aspect-square">
              <img src={resolveImage(images[imgIdx])} alt={product.name} className="h-full w-full object-cover" />
            </div>
            {images.length > 1 && (
              <div className="mt-2 flex gap-2 overflow-x-auto">
                {images.map((im, i) => (
                  <button key={im + i} onClick={() => setImgIdx(i)} aria-label={`View image ${i + 1}`} className={`h-16 w-16 shrink-0 rounded-xl overflow-hidden border ${i === imgIdx ? "ring-2 ring-brand" : ""}`}>
                    <img src={resolveImage(im)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {product.video_url && (
              <video controls src={product.video_url} className="mt-2 rounded-2xl w-full" />
            )}
          </div>


          <div>
            <div className="flex items-center gap-2 text-xs">
              {stock > 0 ? (
                <span className="inline-flex items-center gap-1 text-brand font-medium"><CheckCircle2 className="h-3 w-3" /> In stock ({stock})</span>
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

            {variants.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-muted-foreground">{variants[0].option_group}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setVariant(v.label)}
                      disabled={v.stock <= 0}
                      className={`rounded-full border px-4 py-2 text-sm disabled:opacity-40 disabled:line-through ${variant === v.label ? "border-brand bg-brand-soft/40 font-medium" : ""}`}
                    >
                      {v.label}{v.price_delta_bdt ? ` (+${bdt(v.price_delta_bdt)})` : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                onClick={addToCart}
                disabled={stock <= 0}
                className="flex-1 rounded-full bg-brand text-brand-foreground py-3 text-sm font-medium btn-glow disabled:opacity-50"
              >
                Add to cart
              </button>
              <button onClick={() => cart.toggleWish(product.id)} className="h-12 w-12 grid place-items-center rounded-full border" aria-label={cart.inWishlist(product.id) ? "Remove from wishlist" : "Add to wishlist"}>
                <Heart className={`h-5 w-5 ${cart.inWishlist(product.id) ? "fill-accent-orange text-accent-orange" : ""}`} />
              </button>
            </div>
            <button
              onClick={buyNow}
              disabled={stock <= 0}
              className="mt-3 w-full rounded-full bg-accent-orange text-accent-orange-foreground py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Zap className="h-4 w-4" /> Buy Now — এখনই কিনুন
            </button>
            <QuickCheckout open={quick} onOpenChange={setQuick} item={{ productId: product.id, name: product.name, price, image: images[imgIdx] ?? images[0], variant, qty }} />

            {stock <= 0 && <StockAlert productId={product.id} />}


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

        <Reviews productId={product.id} slug={product.slug} />



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

function StockAlert({ productId }: { productId: string }) {
  const [contact, setContact] = useState("");
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const isEmail = contact.includes("@");
    const { error } = await supabase.from("stock_alerts").insert({
      product_id: productId,
      email: isEmail ? contact : null,
      phone: isEmail ? null : contact,
    });
    if (error) { toast.error("Could not save. Try again."); return; }
    setDone(true);
    toast.success("We'll notify you when it's back!");
  }
  if (done) return <p className="mt-4 text-sm text-brand">You're on the notify list ✓</p>;
  return (
    <form onSubmit={submit} className="mt-4 rounded-2xl border p-3 bg-card">
      <div className="flex items-center gap-2 text-sm font-medium"><BellRing className="h-4 w-4 text-accent-orange" /> Notify me when back in stock</div>
      <div className="mt-2 flex gap-2">
        <input required value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email or phone" className="flex-1 rounded-full border px-3 py-2 text-sm bg-background" />
        <button className="rounded-full bg-brand text-brand-foreground px-4 text-sm">Notify me</button>
      </div>
    </form>
  );
}

function Reviews({ productId, slug }: { productId: string; slug: string }) {
  const qc = useQueryClient();
  const { data: reviews = [] } = useQuery(reviewsQuery(productId));
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { toast.error("Please sign in to write a review"); return; }
      const { error } = await supabase.from("reviews").insert({
        product_id: productId,
        user_id: u.user.id,
        author_name: (u.user.user_metadata?.full_name as string) || u.user.email?.split("@")[0] || "Customer",
        rating,
        comment: comment.trim() || null,
      });
      if (error) throw error;
      setComment("");
      toast.success("Thanks for your review!");
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
      qc.invalidateQueries({ queryKey: ["product", slug] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-xl md:text-2xl">Ratings & reviews</h2>
      <form onSubmit={submit} className="mt-4 rounded-2xl border p-4 bg-card">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} onClick={() => setRating(n)} aria-label={`Rate ${n} star`}>
              <Star className={`h-6 w-6 ${n <= rating ? "fill-accent-orange text-accent-orange" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Share your experience…" className="mt-3 w-full rounded-xl border px-3 py-2 text-sm bg-background" />
        <button disabled={busy} className="mt-2 rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm disabled:opacity-60">Post review</button>
      </form>
      <ul className="mt-4 space-y-3">
        {reviews.length === 0 && <li className="text-sm text-muted-foreground">No reviews yet — be the first!</li>}
        {reviews.map((r) => (
          <li key={r.id} className="rounded-2xl border p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">{r.author_name}</span>
              <span className="text-xs text-accent-orange">{"★".repeat(r.rating)}</span>
            </div>
            {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
            <time className="mt-1 block text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</time>
          </li>
        ))}
      </ul>
    </section>
  );
}
