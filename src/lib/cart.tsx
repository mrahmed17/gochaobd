import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

export interface CartItem {
  /** unique cart line id (product id + variant) */
  id: string;
  productId: string;
  variant?: string | null;
  slug: string;
  name: string;
  price: number;
  image: string;
  qty: number;
  /** stock observed when the line was added/updated — caps the quantity */
  stock?: number;
}

export interface AddInput {
  id: string;
  slug: string;
  name: string;
  price: number;
  image: string;
  variant?: string | null;
  /** live stock for this product/variant; unknown ⇒ 99 (server still guards) */
  stock?: number;
}

interface CartCtx {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: AddInput, qty?: number) => void;
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
const ABANDON_KEY = "gocha_cart_saved_at";

const lineId = (productId: string, variant?: string | null) =>
  variant ? `${productId}::${variant}` : productId;

/** Merge two carts by line id, keeping the larger quantity of each line. */
export function mergeCarts(a: CartItem[], b: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const i of [...a, ...b]) {
    if (!i?.id) continue;
    const ex = map.get(i.id);
    map.set(i.id, ex ? { ...ex, qty: Math.max(ex.qty, i.qty) } : i);
  }
  return [...map.values()];
}

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
    } catch {
      // Corrupt local cart/wishlist JSON: ignore and start fresh.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(WISH_KEY, JSON.stringify(wishlist));
  }, [wishlist, hydrated]);

  // Multi-device sync: merge local cart with the account cart on sign-in, then keep it saved.
  const [syncUser, setSyncUser] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const wishRef = useRef(wishlist);
  wishRef.current = wishlist;
  useEffect(() => {
    if (!hydrated) return;
    let current: string | null = null;
    async function pull(uid: string) {
      const { data } = await supabase
        .from("carts")
        .select("items")
        .eq("user_id", uid)
        .maybeSingle();
      const remote = (Array.isArray(data?.items) ? data!.items : []) as unknown as CartItem[];
      const merged = mergeCarts(itemsRef.current, remote);
      setItems(merged);
      await supabase.from("carts").upsert({ user_id: uid, items: merged as any });
      setSyncUser(uid);

      // Wishlist server sync: merge device wishlist with the account wishlist
      // so favourites follow the customer across phone/laptop.
      const { data: wishRows } = await supabase
        .from("wishlists")
        .select("product_id")
        .eq("user_id", uid);
      const remoteWish = (wishRows ?? []).map((r) => r.product_id);
      const localWish = wishRef.current;
      const mergedWish = [...new Set([...localWish, ...remoteWish])];
      if (mergedWish.length !== localWish.length) setWishlist(mergedWish);
      const missing = mergedWish.filter((id) => !remoteWish.includes(id));
      if (missing.length) {
        await supabase.from("wishlists").upsert(
          missing.map((product_id) => ({ user_id: uid, product_id })),
          { onConflict: "user_id,product_id", ignoreDuplicates: true },
        );
      }
    }
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user.id ?? null;
      if (uid && uid !== current) {
        current = uid;
        pull(uid);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user.id ?? null;
      if (event === "SIGNED_OUT") {
        current = null;
        setSyncUser(null);
        setItems([]);
        return;
      }
      if (uid && uid !== current && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        current = uid;
        pull(uid);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [hydrated]);

  useEffect(() => {
    if (!syncUser) return;
    const t = setTimeout(() => {
      supabase
        .from("carts")
        .upsert({ user_id: syncUser, items: items as any })
        .then(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [items, syncUser]);

  // Abandoned-cart capture: snapshot the cart 60s after the last change.
  useEffect(() => {
    if (!hydrated || !items.length) return;
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.auth.getUser();
        // Prefer the signed-in email; for guests fall back to the phone saved
        // by Quick Checkout so the recovery SMS can actually reach them.
        let guestPhone: string | null = null;
        try {
          const saved = localStorage.getItem("gochao_quick_contact");
          if (saved) guestPhone = JSON.parse(saved)?.phone ?? null;
        } catch {
          /* no readable quick-checkout contact — fall back to email only */
        }
        await supabase.from("abandoned_carts").insert({
          user_id: data.user?.id ?? null,
          contact: data.user?.email ?? guestPhone,
          items: items.map((i) => ({ id: i.productId, name: i.name, qty: i.qty, price: i.price })),
          subtotal_bdt: items.reduce((n, i) => n + i.qty * i.price, 0),
        });
        localStorage.setItem(ABANDON_KEY, String(Date.now()));
      } catch {
        /* abandoned-cart capture is best-effort */
      }
    }, 60_000);
    return () => clearTimeout(t);
  }, [items, hydrated]);

  const value = useMemo<CartCtx>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.qty, 0),
      subtotal: items.reduce((n, i) => n + i.qty * i.price, 0),
      add: (item, qty = 1) => {
        const id = lineId(item.id, item.variant);
        // Never let the stepper push a line past what the store actually has;
        // checkout re-verifies atomically, this only keeps the UI honest.
        const existing = items.find((p) => p.id === id);
        const cap = Math.max(1, item.stock ?? existing?.stock ?? 99);
        const want = Math.max(1, Math.min(qty, cap));
        setItems((prev) => {
          const found = prev.find((p) => p.id === id);
          if (found)
            return prev.map((p) =>
              p.id === id
                ? { ...p, qty: Math.min(p.qty + want, cap), stock: item.stock ?? p.stock }
                : p,
            );
          return [
            ...prev,
            { ...item, id, productId: item.id, variant: item.variant ?? null, qty: want },
          ];
        });
        track("add_to_cart", {
          item_id: item.id,
          item_name: item.name,
          value: item.price * want,
          currency: "BDT",
        });
        toast.success("Added to cart", {
          description: item.variant ? `${item.name} · ${item.variant}` : item.name,
        });
      },
      remove: (id) => setItems((p) => p.filter((i) => i.id !== id)),
      setQty: (id, qty) =>
        setItems((p) =>
          p.map((i) =>
            i.id === id
              ? { ...i, qty: Math.max(1, Math.min(qty, i.stock && i.stock > 0 ? i.stock : 99)) }
              : i,
          ),
        ),
      clear: () => setItems([]),
      wishlist,
      toggleWish: (id) => {
        setWishlist((prev) => {
          const has = prev.includes(id);
          if (!has) track("add_to_wishlist", { item_id: id });
          toast(has ? "Removed from wishlist" : "Added to wishlist");
          // Mirror to the account wishlist (no-op while signed out).
          supabase.auth.getUser().then(({ data }) => {
            const uid = data.user?.id;
            if (!uid) return;
            if (has)
              supabase
                .from("wishlists")
                .delete()
                .eq("user_id", uid)
                .eq("product_id", id)
                .then(() => {});
            else
              supabase
                .from("wishlists")
                .upsert(
                  { user_id: uid, product_id: id },
                  { onConflict: "user_id,product_id", ignoreDuplicates: true },
                )
                .then(() => {});
          });
          return has ? prev.filter((x) => x !== id) : [...prev, id];
        });
      },
      inWishlist: (id) => wishlist.includes(id),
    }),
    [items, wishlist],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be inside CartProvider");
  return c;
}
