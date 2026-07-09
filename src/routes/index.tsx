import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Suspense } from "react";
import { AppShell, Footer } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { categoriesQuery, productsQuery, resolveImage } from "@/lib/queries";
import { ArrowRight, Truck, ShieldCheck, RotateCcw, Phone, Sparkles, Zap } from "lucide-react";
import heroImg from "@/assets/hero-organizers.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GochaoBD — Home Organizers & Smart Home Essentials in Bangladesh" },
      { name: "description", content: "Beautiful, affordable home organizers, kitchen accessories, storage solutions and smart home essentials. Cash on delivery across Bangladesh." },
      { property: "og:title", content: "GochaoBD — Home Organizers & Smart Home Essentials in Bangladesh" },
      { property: "og:description", content: "Beautiful, affordable home organizers, kitchen accessories, storage solutions and smart home essentials. Cash on delivery across Bangladesh." },
      { property: "og:url", content: "https://gochaobd.lovable.app/" },
    ],
    links: [{ rel: "canonical", href: "https://gochaobd.lovable.app/" }],
  }),
  component: HomePage,
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(categoriesQuery()),
      context.queryClient.ensureQueryData(productsQuery({ featured: true })),
      context.queryClient.ensureQueryData(productsQuery({ flash: true })),
      context.queryClient.ensureQueryData(productsQuery({ isNew: true })),
    ]);
  },
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">Failed to load: {error.message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function HomePage() {
  return (
    <AppShell>
      <Hero />
      <Marquee />
      <CategoryStrip />
      <Suspense fallback={<SectionSkeleton />}>
        <FlashSale />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <BestSellers />
      </Suspense>
      <WhyUs />
      <Suspense fallback={<SectionSkeleton />}>
        <NewArrivals />
      </Suspense>
      <Reviews />
      <BeforeAfter />
      <Newsletter />
      <Footer />
    </AppShell>
  );
}

function SectionSkeleton() {
  return <div className="mx-auto max-w-6xl px-4 py-8"><div className="h-40 rounded-2xl bg-muted animate-pulse" /></div>;
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 pt-6 pb-8 md:pt-12 md:pb-16 grid gap-6 md:grid-cols-2 md:items-center">
        <div className="order-2 md:order-1">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft text-brand px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3 w-3" /> New season · Home organizers
          </div>
          <h1 className="mt-4 text-4xl md:text-6xl font-display leading-[1.05]">
            <span className="sr-only">GochaoBD — Home organizers and kitchen essentials in Bangladesh. </span>
            <span aria-hidden="true">A calmer home,<br />one shelf at a time.</span>
          </h1>
          <p className="mt-4 text-muted-foreground max-w-md">
            Thoughtfully designed organizers and kitchen essentials — delivered across Bangladesh.
            Cash on delivery, easy returns.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to="/shop" className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-5 py-3 text-sm font-medium btn-glow">
              Shop now <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/categories" className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-medium hover:bg-muted">
              Browse categories
            </Link>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4 text-xs">
            {[
              ["10k+", "Happy homes"],
              ["4.7★", "Avg. rating"],
              ["64 dist.", "We deliver"],
            ].map(([a, b]) => (
              <div key={a}>
                <div className="text-2xl font-display text-brand">{a}</div>
                <div className="text-muted-foreground">{b}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="order-1 md:order-2 relative">
          <div className="absolute -inset-4 bg-gradient-to-tr from-brand-soft via-transparent to-accent-orange-soft blur-2xl -z-10" />
          <img
            src={heroImg}
            alt="Organized modern kitchen drawer with clear containers"
            width={1600}
            height={1200}
            className="rounded-3xl border shadow-lift w-full h-auto object-cover aspect-[4/3]"
          />
          <div className="absolute -bottom-4 left-4 md:left-6 bg-background rounded-2xl border shadow-lift px-4 py-3 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-accent-orange text-accent-orange-foreground">
              <Truck className="h-4 w-4" />
            </div>
            <div className="text-xs">
              <div className="font-semibold">Cash on delivery</div>
              <div className="text-muted-foreground">Pay when it arrives</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const items = ["Free delivery over ৳1500", "COD available", "Easy 7-day returns", "Verified BD sellers", "Bulk order discounts"];
  return (
    <div className="bg-foreground text-background py-2 overflow-hidden">
      <div className="flex whitespace-nowrap gap-10 animate-marquee text-xs uppercase tracking-widest">
        {[...items, ...items, ...items].map((t, i) => (
          <span key={i} className="flex items-center gap-2"><span className="h-1 w-1 rounded-full bg-accent-orange" />{t}</span>
        ))}
      </div>
    </div>
  );
}

function CategoryStrip() {
  const { data: cats } = useSuspenseQuery(categoriesQuery());
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeader title="Shop by category" href="/categories" />
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cats.map((c) => (
          <Link
            key={c.id}
            to="/category/$slug"
            params={{ slug: c.slug }}
            className="group rounded-2xl border overflow-hidden bg-card hover:shadow-lift transition"
          >
            <div className="aspect-square bg-muted">
              <img src={resolveImage(c.image_url)} alt={c.name} loading="lazy" className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500" />
            </div>
            <div className="p-3">
              <div className="font-medium text-sm">{c.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">Shop now <ArrowRight className="h-3 w-3" /></div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FlashSale() {
  const { data } = useSuspenseQuery(productsQuery({ flash: true }));
  if (!data.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-4">
      <div className="rounded-3xl bg-gradient-to-br from-accent-orange to-accent-orange/80 text-accent-orange-foreground p-5 md:p-8">
        <div className="flex items-center gap-2 text-sm font-medium"><Zap className="h-4 w-4" /> Flash Sale · Limited time</div>
        <h2 className="mt-1 text-2xl md:text-3xl font-display">Deals under ৳700</h2>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.slice(0, 4).map((p) => (
            <div key={p.id} className="bg-background text-foreground rounded-2xl p-3">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BestSellers() {
  const { data } = useSuspenseQuery(productsQuery({ featured: true }));
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeader title="Best sellers" href="/shop" />
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

function NewArrivals() {
  const { data } = useSuspenseQuery(productsQuery({ isNew: true }));
  if (!data.length) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeader title="New arrivals" href="/shop" />
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

function WhyUs() {
  const items = [
    { icon: Truck, title: "Fast delivery", desc: "2–5 days across Bangladesh" },
    { icon: ShieldCheck, title: "Quality checked", desc: "Every product hand-inspected" },
    { icon: RotateCcw, title: "Easy returns", desc: "7-day no-questions returns" },
    { icon: Phone, title: "Real support", desc: "Call, WhatsApp or Messenger" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h2 className="text-2xl md:text-3xl font-display text-center">Why GochaoBD</h2>
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map(({ icon: I, title, desc }) => (
          <div key={title} className="rounded-2xl border bg-card p-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
              <I className="h-5 w-5" />
            </div>
            <div className="mt-3 font-semibold text-sm">{title}</div>
            <div className="text-xs text-muted-foreground mt-1">{desc}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Reviews() {
  const rows = [
    { name: "Nusrat J.", city: "Dhaka", text: "The spice jars are gorgeous and everything actually fits. My kitchen looks like Pinterest now.", rating: 5 },
    { name: "Farhana R.", city: "Chattogram", text: "COD worked perfectly, delivery in 3 days. The drawer organizer is a game changer.", rating: 5 },
    { name: "Sabina A.", city: "Sylhet", text: "Beautiful packaging and quality feels premium. Ordered twice already.", rating: 5 },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeader title="Loved by customers" />
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {rows.map((r) => (
          <div key={r.name} className="rounded-2xl border bg-card p-5">
            <div className="flex text-accent-orange">{"★".repeat(r.rating)}</div>
            <p className="mt-3 text-sm">{r.text}</p>
            <div className="mt-4 text-xs text-muted-foreground">— {r.name}, {r.city}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BeforeAfter() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeader title="Before & after" />
      <div className="mt-4 rounded-3xl border bg-gradient-to-br from-brand-soft to-accent-orange-soft p-8 text-center">
        <p className="text-sm text-muted-foreground max-w-lg mx-auto">
          Real transformations from customers across Bangladesh — tag <span className="font-semibold text-foreground">@gochaobd</span> on Instagram to be featured here.
        </p>
      </div>
    </section>
  );
}

function Newsletter() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <div className="rounded-3xl bg-foreground text-background p-8 md:p-12 text-center">
        <h2 className="text-2xl md:text-3xl font-display">Get 10% off your first order</h2>
        <p className="mt-2 text-sm opacity-80">Join our newsletter — no spam, just occasional drops.</p>
        <form className="mt-5 mx-auto max-w-md flex gap-2" onSubmit={(e) => e.preventDefault()}>
          <input type="email" required placeholder="your@email.com" className="flex-1 rounded-full bg-background/10 border border-background/20 px-4 py-3 text-sm placeholder:text-background/50 outline-none focus:border-background/60" />
          <button className="rounded-full bg-accent-orange text-accent-orange-foreground px-5 py-3 text-sm font-medium">Join</button>
        </form>
      </div>
    </section>
  );
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-xl md:text-2xl font-display">{title}</h2>
      {href && <Link to={href} className="text-xs text-brand font-medium inline-flex items-center gap-1">See all <ArrowRight className="h-3 w-3" /></Link>}
    </div>
  );
}
