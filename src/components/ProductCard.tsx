import { Link } from "@tanstack/react-router";
import { Heart, Star } from "lucide-react";
import type { Product } from "@/lib/queries";
import { resolveImage } from "@/lib/queries";
import { bdt } from "@/lib/format";
import { useCart } from "@/lib/cart";

export function ProductCard({ product }: { product: Product }) {
  const { toggleWish, inWishlist } = useCart();
  const price =
    product.is_flash_sale && product.flash_price_bdt ? product.flash_price_bdt : product.price_bdt;
  const discount =
    product.compare_price_bdt && product.compare_price_bdt > price
      ? Math.round(((product.compare_price_bdt - price) / product.compare_price_bdt) * 100)
      : 0;
  return (
    <div className="group relative">
      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="block rounded-2xl overflow-hidden bg-muted aspect-square border"
      >
        <img
          src={resolveImage(product.images[0])}
          alt={product.name}
          loading="lazy"
          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {discount > 0 && (
          <span className="absolute top-2 left-2 rounded-full bg-accent-orange text-accent-orange-foreground text-[10px] font-semibold px-2 py-0.5">
            −{discount}%
          </span>
        )}
        {product.is_new && !discount && (
          <span className="absolute top-2 left-2 rounded-full bg-brand text-brand-foreground text-[10px] font-semibold px-2 py-0.5">
            NEW
          </span>
        )}
      </Link>
      <button
        onClick={(e) => {
          e.preventDefault();
          toggleWish(product.id);
        }}
        aria-label="Wishlist"
        className="absolute top-2 right-2 h-8 w-8 grid place-items-center rounded-full bg-background/90 border shadow-soft"
      >
        <Heart
          className={`h-4 w-4 ${inWishlist(product.id) ? "fill-accent-orange text-accent-orange" : ""}`}
        />
      </button>
      <div className="pt-2.5">
        <Link to="/product/$slug" params={{ slug: product.slug }} className="block">
          <h3 className="text-sm font-medium line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
        </Link>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Star className="h-3 w-3 fill-accent-orange text-accent-orange" />
          <span>{product.rating}</span>
          <span>· {product.review_count} reviews</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-semibold">{bdt(price)}</span>
          {product.compare_price_bdt && product.compare_price_bdt > price && (
            <span className="text-xs text-muted-foreground line-through">
              {bdt(product.compare_price_bdt)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
