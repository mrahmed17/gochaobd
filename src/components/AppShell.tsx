import { Link, useRouterState } from "@tanstack/react-router";
import { Home, ShoppingBag, Search, Heart, User, ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TopBar />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}

function TopBar() {
  const { count } = useCart();
  return (
    <>
      <div className="bg-brand text-brand-foreground text-[11px] tracking-wide">
        <div className="mx-auto max-w-6xl px-4 py-1.5 flex items-center justify-between overflow-hidden">
          <span>Free delivery on orders over ৳1500 · COD available</span>
          <span className="hidden sm:inline">Made for Bangladeshi homes</span>
        </div>
      </div>
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-brand-foreground font-display text-lg">G</div>
            <span className="font-display text-lg leading-none">GochaoBD</span>
          </Link>
          <Link
            to="/search"
            className="ml-auto flex-1 max-w-md min-w-0 h-10 rounded-full bg-muted border px-4 flex items-center gap-2 text-sm text-muted-foreground hover:bg-muted/80"
          >
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search organizers, jars, racks…</span>
          </Link>
          <Link
            to="/cart"
            className="relative shrink-0 grid h-10 w-10 place-items-center rounded-full hover:bg-muted"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent-orange text-accent-orange-foreground text-[10px] font-semibold grid place-items-center">
                {count}
              </span>
            )}
          </Link>
        </div>
      </header>
    </>
  );
}

function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/shop", icon: ShoppingBag, label: "Shop" },
    { to: "/search", icon: Search, label: "Search" },
    { to: "/wishlist", icon: Heart, label: "Wishlist" },
    { to: "/account", icon: User, label: "Account" },
  ] as const;
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-6xl grid grid-cols-5 h-16">
        {items.map(({ to, icon: Icon, label }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center justify-center gap-0.5 text-[10px] ${
                active ? "text-brand" : "text-muted-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.2]" : ""}`} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="mt-16 border-t bg-secondary/40">
      <div className="mx-auto max-w-6xl px-4 py-10 grid gap-8 sm:grid-cols-2 md:grid-cols-4 text-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-brand text-brand-foreground font-display">G</div>
            <span className="font-display text-lg">GochaoBD</span>
          </div>
          <p className="mt-3 text-muted-foreground">
            Clean, modern home organizers delivered across Bangladesh. Cash on delivery available.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-3">Shop</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/shop">All products</Link></li>
            <li><Link to="/categories">Categories</Link></li>
            <li><Link to="/stores">Our brands</Link></li>
            <li><Link to="/track">Track order</Link></li>
            <li><Link to="/wishlist">Wishlist</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Company</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/about">About</Link></li>
            <li><Link to="/contact">Contact</Link></li>
            <li><Link to="/faq">FAQ</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-3">Policies</div>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/returns">Return & Refund</Link></li>
            <li><Link to="/privacy">Privacy</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} GochaoBD. All rights reserved.
      </div>
    </footer>
  );
}
