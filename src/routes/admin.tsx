import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Fragment, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  verifyAdmin, getAdminData, updateOrderStatus, updatePaymentStatus, updateProductStock,
  saveProduct, deleteProduct, saveCategory, saveCoupon, deleteCoupon,
  saveVariant, deleteVariant, listVariants, getMarketingData, sendCartReminder,
  saveStore, deleteStore, getCustomers, setAdminRole, getReviews, deleteReview,
  deleteCategory, getOrderItems, uploadImage, saveOrderDelivery, getSalesReport, askAssistant,
} from "@/lib/admin.functions";
import { bdt } from "@/lib/format";
import { resolveImage } from "@/lib/queries";
import { toast } from "sonner";
import { Package, ShoppingBag, Users, TrendingUp, Plus, Trash2, Bell, Upload, Download, Sparkles, X } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — GochaoBD" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type Tab = "dash" | "orders" | "reports" | "assistant" | "products" | "categories" | "coupons" | "stores" | "customers" | "reviews" | "marketing";

const emptyProduct = {
  slug: "", name: "", description: "", specs: "", price_bdt: 0, compare_price_bdt: null,
  stock: 0, category_id: null, store_id: null, images: [] as string[], video_url: "", is_featured: false,
  is_new: true, is_flash_sale: false, flash_price_bdt: null,
};

const emptyStore = {
  slug: "", name: "", tagline: "", description: "", theme_color: "#1f7a4d",
  accent_color: "#f97316", logo_url: "", active: true, sort_order: 0,
};

function AdminPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("dash");
  const [stats, setStats] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [carts, setCarts] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [editing, setEditing] = useState<any>(null);
  const [variants, setVariants] = useState<any[]>([]);
  const [catForm, setCatForm] = useState<any>(null);
  const [couponForm, setCouponForm] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [storeForm, setStoreForm] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [custQ, setCustQ] = useState("");
  const [orderQ, setOrderQ] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [payFilter, setPayFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [orderFrom, setOrderFrom] = useState("");
  const [orderTo, setOrderTo] = useState("");
  const [openOrder, setOpenOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { nav({ to: "/auth", replace: true }); return; }
      try {
        await verifyAdmin();
      } catch {
        toast.error("Admin access only");
        nav({ to: "/account", replace: true });
        return;
      }
      setReady(true);
      reload();
    })();
  }, [nav]);

  async function reload() {
    try {
      const [{ orders: o, products: p, coupons: c, stores: st }, m, cu, rv] = await Promise.all([getAdminData(), getMarketingData(), getCustomers(), getReviews()]);
      setOrders(o); setProducts(p); setCoupons(c); setStores(st ?? []);
      setCustomers(cu); setReviews(rv);
      setCategories(m.categories); setAlerts(m.alerts); setCarts(m.carts); setNotifications(m.notifications);
      const live = o.filter((x: any) => x.status !== "cancelled");
      const todayStr = new Date().toDateString();
      setStats({
        revenue: live.reduce((s: number, x: any) => s + x.total_bdt, 0),
        today: live.filter((x: any) => new Date(x.created_at).toDateString() === todayStr).reduce((s: number, x: any) => s + x.total_bdt, 0),
        orders: o.length,
        products: p.length,
        pending: o.filter((x: any) => x.status === "pending").length,
        verifying: o.filter((x: any) => x.payment_status === "verifying").length,
        lowStock: p.filter((x: any) => x.stock <= 5).length,
      });
    } catch (e: any) {
      toast.error(e.message ?? "Could not load admin data");
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await updateOrderStatus({ data: { id, status: status as any } });
      toast.success("Updated"); reload();
    } catch (e: any) { toast.error(e.message ?? "Update failed"); }
  }

  async function setPayment(id: string, payment_status: "paid" | "failed") {
    try { await updatePaymentStatus({ data: { id, payment_status } }); toast.success("Payment updated"); reload(); }
    catch (e: any) { toast.error(e.message ?? "Update failed"); }
  }

  async function updateStock(id: string, stock: number) {
    try {
      const r = await updateProductStock({ data: { id, stock } });
      toast.success(r.notified ? `Stock updated · ${r.notified} restock alerts queued` : "Stock updated");
      reload();
    } catch (e: any) { toast.error(e.message ?? "Update failed"); }
  }

  async function openProduct(p: any) {
    const draft = p ? { ...p } : { ...emptyProduct };
    setEditing(draft);
    setVariants(p ? await listVariants({ data: { productId: p.id } }) : []);
  }

  async function submitProduct(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: any = {
        ...(editing.id ? { id: editing.id } : {}),
        slug: editing.slug.trim(),
        name: editing.name.trim(),
        description: editing.description || null,
        specs: editing.specs || null,
        price_bdt: Number(editing.price_bdt) || 0,
        compare_price_bdt: editing.compare_price_bdt ? Number(editing.compare_price_bdt) : null,
        stock: Number(editing.stock) || 0,
        category_id: editing.category_id || null,
        store_id: editing.store_id || null,
        images: Array.isArray(editing.images) ? editing.images : String(editing.images || "").split(",").map((s: string) => s.trim()).filter(Boolean),
        video_url: editing.video_url || null,
        is_featured: !!editing.is_featured,
        is_new: !!editing.is_new,
        is_flash_sale: !!editing.is_flash_sale,
        flash_price_bdt: editing.flash_price_bdt ? Number(editing.flash_price_bdt) : null,
      };
      const r = await saveProduct({ data: payload });
      toast.success("Product saved");
      setEditing(null);
      void r; reload();
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
  }

  async function removeProduct(id: string) {
    try { await deleteProduct({ data: { id } }); toast.success("Product deleted"); setEditing(null); reload(); }
    catch (e: any) { toast.error(e.message ?? "Delete failed"); }
  }

  async function addVariant() {
    if (!editing?.id) { toast.error("Save the product first"); return; }
    try {
      await saveVariant({ data: { product_id: editing.id, option_group: "Size", label: "New option", price_delta_bdt: 0, stock: 0 } });
      setVariants(await listVariants({ data: { productId: editing.id } }));
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  }

  async function patchVariant(v: any, patch: any) {
    try {
      await saveVariant({ data: { id: v.id, product_id: v.product_id, option_group: patch.option_group ?? v.option_group, label: patch.label ?? v.label, price_delta_bdt: Number(patch.price_delta_bdt ?? v.price_delta_bdt), stock: Number(patch.stock ?? v.stock) } });
      setVariants(await listVariants({ data: { productId: v.product_id } }));
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  }

  async function removeVariant(v: any) {
    await deleteVariant({ data: { id: v.id } });
    setVariants(await listVariants({ data: { productId: v.product_id } }));
  }

  async function submitCategory(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveCategory({ data: { ...(catForm.id ? { id: catForm.id } : {}), slug: catForm.slug.trim(), name: catForm.name.trim(), image_url: catForm.image_url || null, sort_order: Number(catForm.sort_order) || 0, store_id: catForm.store_id || null } });
      toast.success("Category saved"); setCatForm(null); reload();
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
  }

  async function submitCoupon(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveCoupon({ data: { code: couponForm.code.trim(), discount_type: couponForm.discount_type, discount_value: Number(couponForm.discount_value) || 0, min_order_bdt: Number(couponForm.min_order_bdt) || 0, active: !!couponForm.active } });
      toast.success("Coupon saved"); setCouponForm(null); reload();
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
  }

  async function submitStore(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveStore({
        data: {
          ...(storeForm.id ? { id: storeForm.id } : {}),
          slug: storeForm.slug.trim().toLowerCase(),
          name: storeForm.name.trim(),
          tagline: storeForm.tagline || null,
          description: storeForm.description || null,
          theme_color: storeForm.theme_color || "#1f7a4d",
          accent_color: storeForm.accent_color || "#f97316",
          logo_url: storeForm.logo_url || null,
          active: !!storeForm.active,
          sort_order: Number(storeForm.sort_order) || 0,
        },
      });
      toast.success("Store saved"); setStoreForm(null); reload();
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
  }

  async function removeStore(id: string) {
    try { await deleteStore({ data: { id } }); toast.success("Store deleted"); setStoreForm(null); reload(); }
    catch (e: any) { toast.error(e.message ?? "Delete failed"); }
  }

  async function toggleOrder(id: string) {
    if (openOrder === id) { setOpenOrder(null); return; }
    setOpenOrder(id);
    if (!orderItems[id]) {
      try { const rows = await getOrderItems({ data: { orderId: id } }); setOrderItems((m) => ({ ...m, [id]: rows })); }
      catch (e: any) { toast.error(e.message); }
    }
  }

  async function toggleAdmin(c: any) {
    if (!confirm(c.is_admin ? `Remove admin access from ${c.email}?` : `Give admin access to ${c.email}?`)) return;
    try { await setAdminRole({ data: { userId: c.id, admin: !c.is_admin } }); toast.success("Role updated"); reload(); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  }

  async function removeReview(id: string) {
    if (!confirm("Delete this review?")) return;
    try { await deleteReview({ data: { id } }); toast.success("Review deleted"); reload(); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
  }


  if (!ready) return <AppShell><div className="p-8 text-sm">Checking access…</div></AppShell>;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl">Admin panel</h1>
          <Link to="/" className="text-sm text-brand">← Back to store</Link>
        </div>
        <div className="mt-4 flex gap-2 border-b -mx-4 px-4 overflow-x-auto">
          {(["dash", "orders", "reports", "assistant", "products", "categories", "coupons", "stores", "customers", "reviews", "marketing"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`whitespace-nowrap px-4 py-2 text-sm capitalize border-b-2 ${tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground"}`}>
              {t === "dash" ? "Dashboard" : t === "assistant" ? "AI assistant" : t}
            </button>
          ))}
        </div>

        {tab === "reports" && <ReportsPanel />}
        {tab === "assistant" && <AssistantPanel />}

        {tab === "dash" && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={TrendingUp} label="Revenue (excl. cancelled)" value={bdt(stats.revenue || 0)} />
              <Stat icon={ShoppingBag} label="Orders" value={stats.orders ?? 0} />
              <Stat icon={Package} label="Products" value={stats.products ?? 0} />
              <Stat icon={Users} label="Customers" value={customers.length} />
              <Stat icon={ShoppingBag} label="Pending orders" value={stats.pending ?? 0} />
              <Stat icon={TrendingUp} label="Payments to verify" value={stats.verifying ?? 0} />
              <Stat icon={Package} label="Low stock (≤5)" value={stats.lowStock ?? 0} />
              <Stat icon={TrendingUp} label="Today's sales" value={bdt(stats.today || 0)} />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <section className="rounded-2xl border bg-card p-4">
                <h2 className="font-semibold">Recent orders</h2>
                <ul className="mt-2 divide-y text-sm">
                  {orders.slice(0, 6).map((o) => (
                    <li key={o.id} className="py-2 flex justify-between gap-2"><span className="font-mono text-xs">{o.order_number}<span className="ml-2 font-sans text-muted-foreground">{o.customer_name}</span></span><span>{bdt(o.total_bdt)} · <span className="capitalize">{o.status}</span></span></li>
                  ))}
                  {!orders.length && <li className="py-2 text-muted-foreground">No orders yet.</li>}
                </ul>
              </section>
              <section className="rounded-2xl border bg-card p-4">
                <h2 className="font-semibold">Low stock</h2>
                <ul className="mt-2 divide-y text-sm">
                  {products.filter((p) => p.stock <= 5).slice(0, 8).map((p) => (
                    <li key={p.id} className="py-2 flex justify-between"><span className="line-clamp-1">{p.name}</span><span className={p.stock === 0 ? "text-destructive" : ""}>{p.stock} left</span></li>
                  ))}
                  {!products.some((p) => p.stock <= 5) && <li className="py-2 text-muted-foreground">All products well stocked.</li>}
                </ul>
              </section>
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="mt-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input value={orderQ} onChange={(e) => setOrderQ(e.target.value)} placeholder="Search order no, name, phone or tracking" aria-label="Search orders" className="flex-1 min-w-48 rounded-xl border px-3 py-2 text-sm bg-background" />
            <select value={orderFilter} onChange={(e) => setOrderFilter(e.target.value)} aria-label="Filter by status" className="rounded-xl border px-3 py-2 text-sm bg-background">
              {["all", "pending", "confirmed", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={payFilter} onChange={(e) => setPayFilter(e.target.value)} aria-label="Filter by payment" className="rounded-xl border px-3 py-2 text-sm bg-background">
              {["all", "cod", "awaiting", "verifying", "paid", "failed"].map((s) => <option key={s} value={s}>{s === "all" ? "all payments" : s}</option>)}
            </select>
            <select value={zoneFilter} onChange={(e) => setZoneFilter(e.target.value)} aria-label="Filter by zone" className="rounded-xl border px-3 py-2 text-sm bg-background">
              <option value="all">all zones</option>
              {[...new Set(orders.map((o) => o.delivery_zone))].map((z) => <option key={z} value={z}>{z}</option>)}
            </select>
            <input type="date" value={orderFrom} onChange={(e) => setOrderFrom(e.target.value)} aria-label="From date" className="rounded-xl border px-3 py-2 text-sm bg-background" />
            <input type="date" value={orderTo} onChange={(e) => setOrderTo(e.target.value)} aria-label="To date" className="rounded-xl border px-3 py-2 text-sm bg-background" />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {["pending", "confirmed", "shipped", "delivered", "cancelled"].map((s) => (
              <button key={s} onClick={() => setOrderFilter(orderFilter === s ? "all" : s)} className={`rounded-full border px-3 py-1 capitalize ${orderFilter === s ? "bg-brand text-brand-foreground" : "bg-card"}`}>{s} · {orders.filter((o) => o.status === s).length}</button>
            ))}
          </div>
          <div className="rounded-2xl border overflow-x-auto bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Total</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {orders.filter((o) => {
                  if (orderFilter !== "all" && o.status !== orderFilter) return false;
                  if (payFilter === "cod" ? o.payment_method !== "cod" : payFilter !== "all" && (o.payment_method === "cod" || o.payment_status !== payFilter)) return false;
                  if (zoneFilter !== "all" && o.delivery_zone !== zoneFilter) return false;
                  const d = o.created_at.slice(0, 10);
                  if (orderFrom && d < orderFrom) return false;
                  if (orderTo && d > orderTo) return false;
                  return `${o.order_number} ${o.customer_name} ${o.customer_phone} ${o.tracking_number ?? ""}`.toLowerCase().includes(orderQ.toLowerCase());
                }).map((o) => (
                  <Fragment key={o.id}>
                  <tr>
                    <td className="p-3 font-mono text-xs">{o.order_number}<div className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</div>
                      <button onClick={() => toggleOrder(o.id)} className="mt-1 font-sans text-brand underline">{openOrder === o.id ? "Hide details" : "Details"}</button>
                    </td>
                    <td className="p-3">{o.customer_name}<div className="text-xs text-muted-foreground">{o.customer_phone}</div></td>
                    <td className="p-3 font-semibold">{bdt(o.total_bdt)}
                      {o.payment_method !== "cod" && (
                        <div className="text-xs font-normal text-muted-foreground">
                          {o.payment_method} · {o.payment_status}{o.payment_ref ? ` · ${o.payment_ref}` : ""}
                          {o.payment_status === "verifying" && (
                            <span className="ml-1 inline-flex gap-1">
                              <button onClick={() => setPayment(o.id, "paid")} className="text-brand underline">Mark paid</button>
                              <button onClick={() => setPayment(o.id, "failed")} className="text-destructive underline">Reject</button>
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-3">
                      <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} aria-label="Order status" className="rounded-full border px-2 py-1 text-xs bg-background">
                        {["pending", "confirmed", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                  {openOrder === o.id && (
                    <tr><td colSpan={4} className="p-3 bg-muted/50 text-xs">
                      <DeliveryProgress order={o} />
                      <DeliveryForm order={o} onSaved={reload} />
                      <div className="grid sm:grid-cols-2 gap-3 mt-3">
                        <div>
                          <div className="font-semibold">Delivery</div>
                          <div>{o.address_line}, {o.city}{o.district ? `, ${o.district}` : ""}</div>
                          <div>Zone: {o.delivery_zone}{o.guest_email ? ` · ${o.guest_email}` : ""}</div>
                          {o.notes && <div>Note: {o.notes}</div>}
                          <div className="mt-1">Subtotal {bdt(o.subtotal_bdt)} · Shipping {bdt(o.shipping_bdt)} · Discount {bdt(o.discount_bdt)}{o.coupon_code ? ` (${o.coupon_code})` : ""}</div>
                        </div>
                        <ul className="space-y-1">
                          {(orderItems[o.id] ?? []).map((it: any) => (
                            <li key={it.id} className="flex justify-between gap-2"><span>{it.product_name}{it.variant_label ? ` (${it.variant_label})` : ""} × {it.qty}</span><span>{bdt(it.unit_price_bdt * it.qty)}</span></li>
                          ))}
                          {!orderItems[o.id] && <li>Loading…</li>}
                        </ul>
                      </div>
                    </td></tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {!orders.length && <div className="p-8 text-center text-muted-foreground text-sm">No orders yet.</div>}
          </div>
          </div>
        )}

        {tab === "products" && (
          <div className="mt-6 space-y-4">
            <button onClick={() => openProduct(null)} className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"><Plus className="h-4 w-4" />New product</button>
            <div className="rounded-2xl border overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr><th className="p-3">Product</th><th className="p-3">Price</th><th className="p-3">Stock</th><th className="p-3"></th></tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="p-3"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.slug}</div></td>
                      <td className="p-3">{bdt(p.price_bdt)}</td>
                      <td className="p-3">
                        <input type="number" aria-label="Stock" defaultValue={p.stock} onBlur={(e) => updateStock(p.id, parseInt(e.target.value) || 0)} className="w-20 rounded-lg border px-2 py-1 text-sm bg-background" />
                      </td>
                      <td className="p-3 text-right"><button onClick={() => openProduct(p)} className="text-xs text-brand">Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editing && (
              <form onSubmit={submitProduct} className="rounded-2xl border bg-card p-4 space-y-3">
                <h2 className="font-semibold">{editing.id ? "Edit product" : "New product"}</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <F label="Name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} required />
                  <F label="Slug" value={editing.slug} onChange={(v) => setEditing({ ...editing, slug: v })} required />
                  <F label="Price (৳)" type="number" value={editing.price_bdt} onChange={(v) => setEditing({ ...editing, price_bdt: v })} required />
                  <F label="Compare price (৳)" type="number" value={editing.compare_price_bdt ?? ""} onChange={(v) => setEditing({ ...editing, compare_price_bdt: v })} />
                  <F label="Stock" type="number" value={editing.stock} onChange={(v) => setEditing({ ...editing, stock: v })} required />
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Category</span>
                    <select value={editing.category_id ?? ""} onChange={(e) => setEditing({ ...editing, category_id: e.target.value || null })} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background">
                      <option value="">— none —</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Store / brand</span>
                    <select value={editing.store_id ?? ""} onChange={(e) => setEditing({ ...editing, store_id: e.target.value || null })} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background">
                      <option value="">— none —</option>
                      {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </label>
                  <GalleryField value={Array.isArray(editing.images) ? editing.images : String(editing.images || "").split(",").map((s: string) => s.trim()).filter(Boolean)} onChange={(v) => setEditing({ ...editing, images: v })} />
                  <F label="Video URL" value={editing.video_url ?? ""} onChange={(v) => setEditing({ ...editing, video_url: v })} className="sm:col-span-2" />
                  <label className="block sm:col-span-2"><span className="text-xs text-muted-foreground">Description</span>
                    <textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={3} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background" />
                  </label>
                  <label className="block sm:col-span-2"><span className="text-xs text-muted-foreground">Specs</span>
                    <textarea value={editing.specs ?? ""} onChange={(e) => setEditing({ ...editing, specs: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background" />
                  </label>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  {([["is_featured", "Featured"], ["is_new", "New"], ["is_flash_sale", "Flash sale"]] as const).map(([k, label]) => (
                    <label key={k} className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={!!editing[k]} onChange={(e) => setEditing({ ...editing, [k]: e.target.checked })} className="accent-[--color-brand]" />{label}
                    </label>
                  ))}
                  {editing.is_flash_sale && <F label="Flash price (৳)" type="number" value={editing.flash_price_bdt ?? ""} onChange={(v) => setEditing({ ...editing, flash_price_bdt: v })} />}
                </div>

                <div className="rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Variants</h3>
                    <button type="button" onClick={addVariant} className="ml-auto rounded-full border px-3 py-1 text-xs">Add variant</button>
                  </div>
                  {!variants.length ? <p className="mt-2 text-xs text-muted-foreground">No variants. Save the product first, then add sizes or colours.</p> : (
                    <ul className="mt-2 space-y-2">
                      {variants.map((v) => (
                        <li key={v.id} className="grid grid-cols-[1fr,1fr,90px,80px,32px] gap-2 items-center">
                          <input defaultValue={v.option_group} aria-label="Option group" onBlur={(e) => patchVariant(v, { option_group: e.target.value })} className="rounded-lg border px-2 py-1 text-xs bg-background" />
                          <input defaultValue={v.label} aria-label="Variant label" onBlur={(e) => patchVariant(v, { label: e.target.value })} className="rounded-lg border px-2 py-1 text-xs bg-background" />
                          <input type="number" defaultValue={v.price_delta_bdt} aria-label="Price delta" onBlur={(e) => patchVariant(v, { price_delta_bdt: e.target.value })} className="rounded-lg border px-2 py-1 text-xs bg-background" />
                          <input type="number" defaultValue={v.stock} aria-label="Variant stock" onBlur={(e) => patchVariant(v, { stock: e.target.value })} className="rounded-lg border px-2 py-1 text-xs bg-background" />
                          <button type="button" onClick={() => removeVariant(v)} aria-label="Delete variant" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex gap-2">
                  <button className="rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm font-medium">Save product</button>
                  <button type="button" onClick={() => setEditing(null)} className="rounded-full border px-5 py-2 text-sm">Cancel</button>
                  {editing.id && <button type="button" onClick={() => removeProduct(editing.id)} className="ml-auto rounded-full border border-destructive text-destructive px-5 py-2 text-sm">Delete</button>}
                </div>
              </form>
            )}
          </div>
        )}

        {tab === "categories" && (
          <div className="mt-6 space-y-4">
            <button onClick={() => setCatForm({ slug: "", name: "", image_url: "", sort_order: 0 })} className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"><Plus className="h-4 w-4" />New category</button>
            <ul className="rounded-2xl border bg-card divide-y">
              {categories.map((c) => (
                <li key={c.id} className="p-3 flex items-center gap-3 text-sm">
                  <div><div className="font-medium">{c.name}</div><div className="text-xs text-muted-foreground">{c.slug}</div></div>
                  <button onClick={() => setCatForm(c)} className="ml-auto text-xs text-brand">Edit</button>
                </li>
              ))}
            </ul>
            {catForm && (
              <form onSubmit={submitCategory} className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <F label="Name" value={catForm.name} onChange={(v) => setCatForm({ ...catForm, name: v })} required />
                  <F label="Slug" value={catForm.slug} onChange={(v) => setCatForm({ ...catForm, slug: v })} required />
                  <ImageField label="Category photo" folder="categories" value={catForm.image_url ?? ""} onChange={(v) => setCatForm({ ...catForm, image_url: v })} />
                  <F label="Sort order" type="number" value={catForm.sort_order ?? 0} onChange={(v) => setCatForm({ ...catForm, sort_order: v })} />
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Store / brand</span>
                    <select value={catForm.store_id ?? ""} onChange={(e) => setCatForm({ ...catForm, store_id: e.target.value || null })} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background">
                      <option value="">— none —</option>
                      {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm font-medium">Save</button>
                  <button type="button" onClick={() => setCatForm(null)} className="rounded-full border px-5 py-2 text-sm">Cancel</button>
                  {catForm.id && (
                    <button type="button" onClick={async () => { if (!confirm("Delete this category? Its products stay but become uncategorised.")) return; try { await deleteCategory({ data: { id: catForm.id } }); toast.success("Category deleted"); setCatForm(null); reload(); } catch (e: any) { toast.error(e.message); } }} className="ml-auto rounded-full border border-destructive text-destructive px-5 py-2 text-sm">Delete</button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {tab === "coupons" && (
          <div className="mt-6 space-y-4">
            <button onClick={() => setCouponForm({ code: "", discount_type: "percent", discount_value: 10, min_order_bdt: 0, active: true })} className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"><Plus className="h-4 w-4" />New coupon</button>
            <ul className="space-y-2">
              {coupons.map((c) => (
                <li key={c.code} className="flex items-center justify-between rounded-xl bg-muted p-3">
                  <div>
                    <div className="font-mono font-semibold">{c.code}</div>
                    <div className="text-xs text-muted-foreground">{c.discount_type === "percent" ? `${c.discount_value}% off` : `৳${c.discount_value} off`} · min order ৳{c.min_order_bdt}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? "bg-brand text-brand-foreground" : "bg-muted-foreground/20"}`}>{c.active ? "active" : "inactive"}</span>
                    <button onClick={() => setCouponForm(c)} className="text-xs text-brand">Edit</button>
                    <button onClick={async () => { await deleteCoupon({ data: { code: c.code } }); toast.success("Deleted"); reload(); }} aria-label="Delete coupon" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
            {couponForm && (
              <form onSubmit={submitCoupon} className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <F label="Code" value={couponForm.code} onChange={(v) => setCouponForm({ ...couponForm, code: v.toUpperCase() })} required />
                  <label className="block"><span className="text-xs text-muted-foreground">Type</span>
                    <select value={couponForm.discount_type} onChange={(e) => setCouponForm({ ...couponForm, discount_type: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background">
                      <option value="percent">Percent</option><option value="flat">Flat ৳</option>
                    </select>
                  </label>
                  <F label="Value" type="number" value={couponForm.discount_value} onChange={(v) => setCouponForm({ ...couponForm, discount_value: v })} required />
                  <F label="Minimum order (৳)" type="number" value={couponForm.min_order_bdt} onChange={(v) => setCouponForm({ ...couponForm, min_order_bdt: v })} />
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!couponForm.active} onChange={(e) => setCouponForm({ ...couponForm, active: e.target.checked })} className="accent-[--color-brand]" />Active
                </label>
                <div className="flex gap-2">
                  <button className="rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm font-medium">Save</button>
                  <button type="button" onClick={() => setCouponForm(null)} className="rounded-full border px-5 py-2 text-sm">Cancel</button>
                </div>
              </form>
            )}
          </div>
        )}

        {tab === "stores" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Each store is a separate brand (baby, beauty, kitchen…) sharing this admin panel, inventory and customer base.
            </p>
            <button onClick={() => setStoreForm({ ...emptyStore })} className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"><Plus className="h-4 w-4" />New store</button>
            <ul className="rounded-2xl border bg-card divide-y">
              {stores.map((s) => (
                <li key={s.id} className="p-3 flex items-center gap-3 text-sm">
                  <div className="h-8 w-8 rounded-lg shrink-0" style={{ background: `linear-gradient(135deg, ${s.theme_color}, ${s.accent_color})` }} />
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">/store/{s.slug} · {products.filter((p) => p.store_id === s.id).length} products</div>
                  </div>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${s.active ? "bg-brand text-brand-foreground" : "bg-muted-foreground/20"}`}>{s.active ? "active" : "hidden"}</span>
                  <button onClick={() => setStoreForm(s)} className="text-xs text-brand">Edit</button>
                </li>
              ))}
            </ul>
            {storeForm && (
              <form onSubmit={submitStore} className="rounded-2xl border bg-card p-4 space-y-3">
                <h2 className="font-semibold">{storeForm.id ? "Edit store" : "New store"}</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <F label="Name" value={storeForm.name} onChange={(v) => setStoreForm({ ...storeForm, name: v })} required />
                  <F label="Slug (url)" value={storeForm.slug} onChange={(v) => setStoreForm({ ...storeForm, slug: v })} required />
                  <F label="Tagline" value={storeForm.tagline ?? ""} onChange={(v) => setStoreForm({ ...storeForm, tagline: v })} className="sm:col-span-2" />
                  <F label="Primary colour" value={storeForm.theme_color} onChange={(v) => setStoreForm({ ...storeForm, theme_color: v })} />
                  <F label="Accent colour" value={storeForm.accent_color} onChange={(v) => setStoreForm({ ...storeForm, accent_color: v })} />
                  <ImageField label="Logo" folder="stores" value={storeForm.logo_url ?? ""} onChange={(v) => setStoreForm({ ...storeForm, logo_url: v })} />
                  <F label="Sort order" type="number" value={storeForm.sort_order ?? 0} onChange={(v) => setStoreForm({ ...storeForm, sort_order: v })} />
                  <label className="block sm:col-span-2"><span className="text-xs text-muted-foreground">Description</span>
                    <textarea value={storeForm.description ?? ""} onChange={(e) => setStoreForm({ ...storeForm, description: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background" />
                  </label>
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!storeForm.active} onChange={(e) => setStoreForm({ ...storeForm, active: e.target.checked })} className="accent-[--color-brand]" />Visible to shoppers
                </label>
                <div className="flex gap-2">
                  <button className="rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm font-medium">Save store</button>
                  <button type="button" onClick={() => setStoreForm(null)} className="rounded-full border px-5 py-2 text-sm">Cancel</button>
                  {storeForm.id && storeForm.slug !== "home" && (
                    <button type="button" onClick={() => removeStore(storeForm.id)} className="ml-auto rounded-full border border-destructive text-destructive px-5 py-2 text-sm">Delete</button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}


        {tab === "marketing" && (
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <section className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-brand" /><h2 className="font-semibold">Back-in-stock requests</h2></div>
              {!alerts.length ? <p className="mt-3 text-sm text-muted-foreground">No requests yet.</p> : (
                <ul className="mt-3 space-y-2 text-sm">
                  {alerts.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-xl bg-muted p-2">
                      <div className="min-w-0">
                        <div className="font-medium line-clamp-1">{a.products?.name ?? "Product"}</div>
                        <div className="text-xs text-muted-foreground">{a.email ?? a.phone}</div>
                      </div>
                      <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${a.notified ? "bg-brand text-brand-foreground" : "bg-muted-foreground/20"}`}>{a.notified ? "notified" : "waiting"}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">Alerts are sent automatically when you set stock above zero.</p>
            </section>

            <section className="rounded-2xl border bg-card p-4">
              <h2 className="font-semibold">Abandoned carts</h2>
              {!carts.length ? <p className="mt-3 text-sm text-muted-foreground">No abandoned carts.</p> : (
                <ul className="mt-3 space-y-2 text-sm">
                  {carts.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 rounded-xl bg-muted p-2">
                      <div className="min-w-0">
                        <div className="font-medium">{bdt(c.subtotal_bdt)}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{c.contact ?? "no contact"} · {new Date(c.created_at).toLocaleDateString()}</div>
                      </div>
                      <button
                        disabled={!c.contact}
                        onClick={async () => { try { await sendCartReminder({ data: { id: c.id } }); toast.success("Reminder queued"); reload(); } catch (e: any) { toast.error(e.message); } }}
                        className="ml-auto rounded-full border px-3 py-1 text-xs disabled:opacity-40"
                      >Send reminder</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-4 md:col-span-2">
              <h2 className="font-semibold">Recent messages</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {notifications.map((n) => (
                  <li key={n.id} className="rounded-xl bg-muted p-2">
                    <div className="font-medium line-clamp-1">{n.subject}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">{n.channel} → {n.recipient} · {n.status}</div>
                  </li>
                ))}
                {!notifications.length && <li className="text-sm text-muted-foreground">Nothing sent yet.</li>}
              </ul>
            </section>
          </div>
        )}

        {tab === "customers" && (
          <div className="mt-6 space-y-3">
            <input value={custQ} onChange={(e) => setCustQ(e.target.value)} placeholder="Search name, email or phone" aria-label="Search customers" className="w-full sm:w-80 rounded-xl border px-3 py-2 text-sm bg-background" />
            <div className="rounded-2xl border overflow-x-auto bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr><th className="p-3">Customer</th><th className="p-3">Orders</th><th className="p-3">Spent</th><th className="p-3">Joined</th><th className="p-3">Role</th></tr>
                </thead>
                <tbody className="divide-y">
                  {customers.filter((c) => `${c.email} ${c.full_name ?? ""} ${c.phone ?? ""}`.toLowerCase().includes(custQ.toLowerCase())).map((c) => (
                    <tr key={c.id}>
                      <td className="p-3"><div className="font-medium">{c.full_name || "—"}</div><div className="text-xs text-muted-foreground">{c.email}{c.phone ? ` · ${c.phone}` : ""}</div></td>
                      <td className="p-3">{c.order_count}</td>
                      <td className="p-3">{bdt(c.spent_bdt)}</td>
                      <td className="p-3 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="p-3">
                        <button onClick={() => toggleAdmin(c)} className={`rounded-full px-3 py-1 text-xs border ${c.is_admin ? "bg-brand text-brand-foreground border-brand" : ""}`}>{c.is_admin ? "Admin" : "Customer"}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!customers.length && <div className="p-8 text-center text-muted-foreground text-sm">No customers yet.</div>}
            </div>
            <p className="text-xs text-muted-foreground">Click a role to switch between Customer and Admin.</p>
          </div>
        )}

        {tab === "reviews" && (
          <ul className="mt-6 rounded-2xl border bg-card divide-y">
            {reviews.map((r) => (
              <li key={r.id} className="p-3 flex gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{"★".repeat(r.rating)}<span className="text-muted-foreground">{"★".repeat(5 - r.rating)}</span> · {r.author_name}</div>
                  <div className="text-xs text-muted-foreground">{r.products?.name ?? "Product"} · {new Date(r.created_at).toLocaleDateString()}</div>
                  {r.comment && <p className="mt-1">{r.comment}</p>}
                </div>
                <button onClick={() => removeReview(r.id)} aria-label="Delete review" className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
            {!reviews.length && <li className="p-8 text-center text-muted-foreground text-sm">No reviews yet.</li>}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function F({ label, value, onChange, required, type, className }: { label: string; value: any; onChange: (v: string) => void; required?: boolean; type?: string; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">{label}{required && " *"}</span>
      <input type={type ?? "text"} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background" />
    </label>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="h-4 w-4" /></div>
      <div className="mt-2 text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-display">{value}</div>
    </div>
  );
}
