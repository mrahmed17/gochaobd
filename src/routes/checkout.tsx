import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useCart } from "@/lib/cart";
import { bdt } from "@/lib/format";
import { DELIVERY_ZONES, shippingFee } from "@/lib/queries";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — GochaoBD" }, { name: "robots", content: "noindex" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const cart = useCart();
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState<{ code: string; discount: number } | null>(null);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", address: "", city: "Dhaka", district: "", notes: "", payment: "cod", zone: "dhaka",
  });

  const shipping = shippingFee(form.zone, cart.subtotal);
  const discount = applied?.discount ?? 0;
  const total = Math.max(0, cart.subtotal + shipping - discount);


  async function applyCoupon() {
    if (!coupon.trim()) return;
    const { data } = await supabase.from("coupons").select("*").eq("code", coupon.trim().toUpperCase()).eq("active", true).maybeSingle();
    if (!data) { toast.error("Invalid coupon"); return; }
    if (cart.subtotal < data.min_order_bdt) { toast.error(`Minimum order ৳${data.min_order_bdt}`); return; }
    const disc = data.discount_type === "percent" ? Math.round((cart.subtotal * data.discount_value) / 100) : data.discount_value;
    setApplied({ code: data.code, discount: disc });
    toast.success(`Coupon applied: -${bdt(disc)}`);
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!cart.items.length) return;
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: order, error } = await supabase.from("orders").insert({
        user_id: user.user?.id ?? null,
        guest_email: user.user?.email ?? form.email || null,
        customer_name: form.name,
        customer_phone: form.phone,
        address_line: form.address,
        city: form.city,
        district: form.district || null,
        delivery_zone: form.zone,
        notes: form.notes || null,
        payment_method: form.payment,
        subtotal_bdt: cart.subtotal,
        shipping_bdt: shipping,
        discount_bdt: discount,
        total_bdt: total,
        coupon_code: applied?.code ?? null,
      }).select("id, order_number").single();
      if (error) throw error;

      const items = cart.items.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        product_name: i.name,
        product_image: i.image,
        variant_label: i.variant ?? null,
        unit_price_bdt: i.price,
        qty: i.qty,
      }));
      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      const recipient = user.user?.email ?? form.email ?? form.phone;
      if (recipient) {
        await supabase.from("notifications").insert({
          order_id: order.id,
          channel: form.email || user.user?.email ? "email" : "sms",
          recipient,
          subject: `Order ${order.order_number} confirmed`,
          body: `Thank you ${form.name}! Your GochaoBD order ${order.order_number} for ৳${total} is confirmed. Payment: ${form.payment.toUpperCase()}.`,
        });
      }

      track("purchase", { transaction_id: order.order_number, value: total, currency: "BDT", items: items.length });
      cart.clear();
      nav({ to: "/order-success/$number", params: { number: order.order_number } });

    } catch (err: any) {
      toast.error(err.message ?? "Could not place order");
    } finally {
      setLoading(false);
    }
  }

  if (!cart.items.length) {
    return <AppShell><div className="p-8 text-center text-sm text-muted-foreground">Your cart is empty.</div></AppShell>;
  }

  return (
    <AppShell>
      <form onSubmit={placeOrder} className="mx-auto max-w-6xl px-4 py-6 grid md:grid-cols-[1fr,340px] gap-6">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-display">Checkout</h1>
            <p className="text-xs text-muted-foreground mt-1">You can check out as a guest — sign in later to track orders.</p>
          </div>

          <section className="rounded-2xl border p-4 bg-card space-y-3">
            <h2 className="font-semibold">Delivery details</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Full name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
              <Field label="Phone number" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required placeholder="01XXXXXXXXX" />
              <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} required className="sm:col-span-2" />
              <Select label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} options={["Dhaka", "Chattogram", "Sylhet", "Khulna", "Rajshahi", "Barishal", "Rangpur", "Mymensingh"]} />
              <Field label="Area / District (optional)" value={form.district} onChange={(v) => setForm({ ...form, district: v })} />
              <Field label="Order notes (optional)" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} className="sm:col-span-2" />
            </div>
          </section>

          <section className="rounded-2xl border p-4 bg-card space-y-2">
            <h2 className="font-semibold">Payment method</h2>
            {[
              { v: "cod", label: "Cash on Delivery", desc: "Pay in cash when your order arrives" },
              { v: "bkash", label: "bKash", desc: "Send via Personal — we'll confirm on WhatsApp" },
              { v: "nagad", label: "Nagad", desc: "Mobile banking" },
            ].map((o) => (
              <label key={o.v} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${form.payment === o.v ? "border-brand bg-brand-soft/30" : ""}`}>
                <input type="radio" name="pay" checked={form.payment === o.v} onChange={() => setForm({ ...form, payment: o.v })} className="mt-1 accent-[--color-brand]" />
                <div>
                  <div className="font-medium text-sm">{o.label}</div>
                  <div className="text-xs text-muted-foreground">{o.desc}</div>
                </div>
              </label>
            ))}
          </section>
        </div>

        <aside className="md:sticky md:top-20 h-fit rounded-2xl border p-4 bg-card">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="mt-3 space-y-2 text-sm max-h-40 overflow-y-auto">
            {cart.items.map((i) => (
              <li key={i.id} className="flex justify-between gap-2"><span className="line-clamp-1">{i.name} × {i.qty}</span><span>{bdt(i.price * i.qty)}</span></li>
            ))}
          </ul>
          <div className="mt-3 pt-3 border-t">
            <div className="flex gap-2">
              <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code" className="flex-1 rounded-full border px-3 py-2 text-sm bg-background" />
              <button type="button" onClick={applyCoupon} className="rounded-full border px-4 text-sm">Apply</button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Try <code className="font-mono">GOCHAO10</code> or <code className="font-mono">NEW100</code></p>
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            <Row label="Subtotal" value={bdt(cart.subtotal)} />
            <Row label={shipping === 0 ? "Shipping (free)" : "Shipping"} value={bdt(shipping)} />
            {discount > 0 && <Row label="Discount" value={`-${bdt(discount)}`} />}
            <div className="border-t pt-2 mt-2 flex justify-between font-semibold text-base">
              <span>Total</span><span>{bdt(total)}</span>
            </div>
          </dl>
          <button disabled={loading} className="mt-4 w-full rounded-full bg-brand text-brand-foreground py-3 text-sm font-medium btn-glow disabled:opacity-60 inline-flex items-center justify-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Place order
          </button>
        </aside>
      </form>
    </AppShell>
  );
}

function Field({ label, value, onChange, required, placeholder, className }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">{label}{required && " *"}</span>
      <input required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-brand" />
    </label>
  );
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{label}</dt><dd>{value}</dd></div>;
}
