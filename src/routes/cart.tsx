import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Footer } from "@/components/AppShell";
import { useCart } from "@/lib/cart";
import { bdt } from "@/lib/format";
import { resolveImage, shippingFee } from "@/lib/queries";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Cart — GochaoBD" }] }),
  component: CartPage,
});

function CartPage() {
  const cart = useCart();
  const shipping = cart.subtotal === 0 ? 0 : shippingFee("dhaka", cart.subtotal);
  const total = cart.subtotal + shipping;

  if (!cart.items.length) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <div className="mx-auto h-16 w-16 grid place-items-center rounded-full bg-muted"><ShoppingBag className="h-6 w-6" /></div>
          <h1 className="mt-4 font-display text-2xl">Your cart is empty</h1>
          <p className="mt-2 text-sm text-muted-foreground">Start adding beautiful things to your home.</p>
          <Link to="/shop" className="mt-6 inline-flex rounded-full bg-brand text-brand-foreground px-5 py-3 text-sm font-medium">Shop now</Link>
        </div>
        <Footer />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 grid md:grid-cols-[1fr,340px] gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-display">Your cart</h1>
          <ul className="mt-4 divide-y border rounded-2xl bg-card">
            {cart.items.map((i) => (
              <li key={i.id} className="p-3 flex gap-3">
                <img src={resolveImage(i.image)} alt={i.name} className="h-20 w-20 rounded-xl object-cover bg-muted" />
                <div className="flex-1 min-w-0">
                  <Link to="/product/$slug" params={{ slug: i.slug }} className="font-medium text-sm line-clamp-2">{i.name}</Link>
                  {i.variant && (
                    <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{i.variant}</span>
                  )}
                  <div className="mt-1 text-sm font-semibold">{bdt(i.price)}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="inline-flex items-center rounded-full border">
                      <button onClick={() => cart.setQty(i.id, i.qty - 1)} className="h-8 w-8 grid place-items-center"><Minus className="h-3 w-3" /></button>
                      <span className="w-8 text-center text-sm">{i.qty}</span>
                      <button onClick={() => cart.setQty(i.id, i.qty + 1)} className="h-8 w-8 grid place-items-center"><Plus className="h-3 w-3" /></button>
                    </div>
                    <button onClick={() => cart.remove(i.id)} className="ml-auto text-muted-foreground hover:text-destructive p-2" aria-label="remove"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <aside className="md:sticky md:top-20 h-fit rounded-2xl border p-4 bg-card">
          <h2 className="font-semibold">Order summary</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Subtotal" value={bdt(cart.subtotal)} />
            <Row label={`Shipping${shipping === 0 ? " (free)" : " (Inside Dhaka)"}`} value={bdt(shipping)} />
            <div className="border-t pt-2 mt-2 flex justify-between font-semibold text-base">
              <span>Total</span><span>{bdt(total)}</span>
            </div>
          </dl>
          <Link to="/checkout" className="mt-4 block text-center rounded-full bg-brand text-brand-foreground py-3 text-sm font-medium btn-glow">
            Proceed to checkout
          </Link>
          <p className="mt-2 text-xs text-muted-foreground text-center">Cash on Delivery available</p>
        </aside>
      </div>
      <Footer />
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>;
}
