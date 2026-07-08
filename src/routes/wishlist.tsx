import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell, Footer } from "@/components/AppShell";
import { ProductCard } from "@/components/ProductCard";
import { productsByIdsQuery } from "@/lib/queries";
import { useCart } from "@/lib/cart";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — GochaoBD" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlist } = useCart();
  const { data = [], isLoading } = useQuery(productsByIdsQuery(wishlist));

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center gap-2"><Heart className="h-5 w-5 text-accent-orange fill-accent-orange" /><h1 className="text-2xl md:text-3xl font-display">Your wishlist</h1></div>
        {!wishlist.length ? (
          <div className="mt-8 rounded-2xl border p-8 text-center text-sm text-muted-foreground">
            No favourites yet. <Link to="/shop" className="text-brand">Discover products</Link>
          </div>
        ) : isLoading ? (
          <div className="mt-8 text-sm text-muted-foreground">Loading…</div>
        ) : (
          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
      <Footer />
    </AppShell>
  );
}
