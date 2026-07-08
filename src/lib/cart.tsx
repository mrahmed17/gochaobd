import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

export interface CartItem {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  qty: number;
}

interface CartCtx {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "qty">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  wishlist: string[];
  toggleWish: (id: string) => void;
  inWishlist: (id: string) => boolean;
}

const Ctx = createContext<CartCtx | null>(null);
const CART_KEY = "gocha_cart_v1";
const WISH_KEY = "gocha_wishlist_v1";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const c = localStorage.getItem(CART_KEY);
      if (c) setItems(JSON.parse(c));
      const w = localStorage.getItem(WISH_KEY);
      if (w) setWishlist(JSON.parse(w));
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist, hydrated]);

  const value = useMemo<CartCtx>(() => ({
    items,
    count: items.reduce((n, i) => n + i.qty, 0),
    subtotal: items.reduce((n, i) => n + i.qty * i.price, 0),
    add: (item, qty = 1) => {
      setItems((prev) => {
        const found = prev.find((p) => p.id === item.id);
        if (found) return prev.map((p) => (p.id === item.id ? { ...p, qty: p.qty + qty } : p));
        return [...prev, { ...item, qty }];
      });
      toast.success("Added to cart", { description: item.name });
    },
    remove: (id) => setItems((p) => p.filter((i) => i.id !== id)),
    setQty: (id, qty) =>
      setItems((p) => p.map((i) => (i.id === id ? { ...i, qty: Math.max(1, qty) } : i))),
    clear: () => setItems([]),
    wishlist,
    toggleWish: (id) =>
      setWishlist((prev) => {
        const has = prev.includes(id);
        toast(has ? "Removed from wishlist" : "Added to wishlist");
        return has ? prev.filter((x) => x !== id) : [...prev, id];
      }),
    inWishlist: (id) => wishlist.includes(id),
  }), [items, wishlist]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be inside CartProvider");
  return c;
}
