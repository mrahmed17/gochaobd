import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { printInvoice } from "@/lib/invoice";
import { Fragment, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import {
  verifyAdmin,
  getAdminData,
  updateOrderStatus,
  updatePaymentStatus,
  updateProductStock,
  saveProduct,
  deleteProduct,
  saveCategory,
  saveCoupon,
  deleteCoupon,
  saveVariant,
  deleteVariant,
  listVariants,
  getMarketingData,
  sendCartReminder,
  saveStore,
  deleteStore,
  getCustomers,
  setAdminRole,
  getReviews,
  deleteReview,
  deleteCategory,
  getOrderItems,
  bulkUpdateOrderStatus,
  getPhoneRisk,
  setPhoneRisk,
  setUserSessionRevoked,
  getBundles,
  saveBundle,
  deleteBundle,
} from "@/lib/admin.functions";
import {
  uploadImage,
  saveOrderDelivery,
  getSalesReport,
  askAssistant,
  dispatchToCourier,
  sendOrderSms,
  getOrderComms,
  bulkDispatchToCourier,
} from "@/lib/admin-extra.functions";
import { sendCartRecoveryNudges } from "@/lib/sms.functions";
import { bdt } from "@/lib/format";
import { resolveImage } from "@/lib/queries";
import { toast } from "sonner";
import {
  Package,
  ShoppingBag,
  Users,
  TrendingUp,
  Plus,
  Trash2,
  Bell,
  Upload,
  Download,
  Sparkles,
  X,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — GochaoBD" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

type Tab =
  | "dash"
  | "orders"
  | "reports"
  | "assistant"
  | "products"
  | "categories"
  | "coupons"
  | "stores"
  | "customers"
  | "reviews"
  | "marketing";

const emptyProduct = {
  slug: "",
  name: "",
  description: "",
  specs: "",
  price_bdt: 0,
  compare_price_bdt: null,
  stock: 0,
  category_id: null,
  store_id: null,
  images: [] as string[],
  video_url: "",
  is_featured: false,
  is_new: true,
  is_flash_sale: false,
  flash_price_bdt: null,
};

const emptyStore = {
  slug: "",
  name: "",
  tagline: "",
  description: "",
  theme_color: "#1f7a4d",
  accent_color: "#f97316",
  logo_url: "",
  active: true,
  sort_order: 0,
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [phoneRisk, setPhoneRiskRows] = useState<Awaited<ReturnType<typeof getPhoneRisk>>>([]);
  const [bundles, setBundles] = useState<Awaited<ReturnType<typeof getBundles>>>([]);
  const [bundleForm, setBundleForm] = useState<{
    id?: string;
    productId: string;
    withProductId: string;
    discountBdt: string;
    active: boolean;
  } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        nav({ to: "/auth", replace: true });
        return;
      }
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
      const [{ orders: o, products: p, coupons: c, stores: st }, m, cu, rv] = await Promise.all([
        getAdminData(),
        getMarketingData(),
        getCustomers(),
        getReviews(),
      ]);
      setOrders(o);
      setProducts(p);
      setCoupons(c);
      setStores(st ?? []);
      setCustomers(cu);
      setReviews(rv);
      setCategories(m.categories);
      setAlerts(m.alerts);
      setCarts(m.carts);
      setNotifications(m.notifications);
      getPhoneRisk()
        .then(setPhoneRiskRows)
        .catch(() => {});
      getBundles()
        .then(setBundles)
        .catch(() => {});
      const live = o.filter((x: any) => x.status !== "cancelled");
      const todayStr = new Date().toDateString();
      setStats({
        revenue: live.reduce((s: number, x: any) => s + x.total_bdt, 0),
        today: live
          .filter((x: any) => new Date(x.created_at).toDateString() === todayStr)
          .reduce((s: number, x: any) => s + x.total_bdt, 0),
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
      toast.success("Updated");
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
  }

  const riskByPhone = new Map(phoneRisk.map((r) => [r.phone, r]));
  const phoneOf = (o: { customer_phone?: string | null }) =>
    String(o.customer_phone ?? "")
      .replace(/[\s-]/g, "")
      .replace(/^\+?88/, "0")
      .replace(/^880/, "0");

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulk(fn: (ids: string[]) => Promise<unknown>, okMsg: string) {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const r = (await fn(ids)) as { updated?: number } | undefined;
      toast.success(typeof r?.updated === "number" ? `${okMsg} · ${r.updated} orders` : okMsg);
      setSelected(new Set());
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bulk action failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function setRisk(phone: string, patch: { blocked?: boolean; note?: string | null }) {
    try {
      await setPhoneRisk({ data: { phone, ...patch } });
      toast.success("Risk list updated");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function runNudges() {
    setBulkBusy(true);
    try {
      const r = await sendCartRecoveryNudges({ data: {} });
      toast.success(`Recovery SMS: ${r.sent} sent · ${r.skipped} skipped`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Nudge run failed");
    } finally {
      setBulkBusy(false);
    }
  }

  async function submitBundle() {
    if (!bundleForm) return;
    if (!bundleForm.productId || !bundleForm.withProductId) {
      toast.error("দুটি প্রোডাক্ট নির্বাচন করুন");
      return;
    }
    try {
      await saveBundle({
        data: {
          id: bundleForm.id,
          productId: bundleForm.productId,
          withProductId: bundleForm.withProductId,
          discountBdt: Number(bundleForm.discountBdt) || 0,
          active: bundleForm.active,
        },
      });
      toast.success("বান্ডল ডিল সেভ হয়েছে");
      setBundleForm(null);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function removeBundle(id: string) {
    try {
      await deleteBundle({ data: { id } });
      toast.success("Bundle deleted");
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  async function toggleSessionRevocation(userId: string, revoked: boolean) {
    try {
      await setUserSessionRevoked({ data: { userId, revoked } });
      toast.success(
        revoked
          ? "অ্যাক্সেস বাতিল — সব সার্ভার অ্যাকশন ব্লক হয়েছে"
          : "অ্যাক্সেস ফিরিয়ে দেওয়া হয়েছে",
      );
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  async function setPayment(id: string, payment_status: "paid" | "failed") {
    try {
      await updatePaymentStatus({ data: { id, payment_status } });
      toast.success("Payment updated");
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
  }

  async function updateStock(id: string, stock: number) {
    try {
      const r = await updateProductStock({ data: { id, stock } });
      toast.success(
        r.notified ? `Stock updated · ${r.notified} restock alerts queued` : "Stock updated",
      );
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    }
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
        images: Array.isArray(editing.images)
          ? editing.images
          : String(editing.images || "")
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean),
        video_url: editing.video_url || null,
        is_featured: !!editing.is_featured,
        is_new: !!editing.is_new,
        is_flash_sale: !!editing.is_flash_sale,
        flash_price_bdt: editing.flash_price_bdt ? Number(editing.flash_price_bdt) : null,
      };
      const r = await saveProduct({ data: payload });
      toast.success("Product saved");
      setEditing(null);
      void r;
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
  }

  async function removeProduct(id: string) {
    try {
      await deleteProduct({ data: { id } });
      toast.success("Product deleted");
      setEditing(null);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  }

  async function addVariant() {
    if (!editing?.id) {
      toast.error("Save the product first");
      return;
    }
    try {
      await saveVariant({
        data: {
          product_id: editing.id,
          option_group: "Size",
          label: "New option",
          price_delta_bdt: 0,
          stock: 0,
        },
      });
      setVariants(await listVariants({ data: { productId: editing.id } }));
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function patchVariant(v: any, patch: any) {
    try {
      await saveVariant({
        data: {
          id: v.id,
          product_id: v.product_id,
          option_group: patch.option_group ?? v.option_group,
          label: patch.label ?? v.label,
          price_delta_bdt: Number(patch.price_delta_bdt ?? v.price_delta_bdt),
          stock: Number(patch.stock ?? v.stock),
        },
      });
      setVariants(await listVariants({ data: { productId: v.product_id } }));
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function removeVariant(v: any) {
    await deleteVariant({ data: { id: v.id } });
    setVariants(await listVariants({ data: { productId: v.product_id } }));
  }

  async function submitCategory(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveCategory({
        data: {
          ...(catForm.id ? { id: catForm.id } : {}),
          slug: catForm.slug.trim(),
          name: catForm.name.trim(),
          image_url: catForm.image_url || null,
          sort_order: Number(catForm.sort_order) || 0,
          store_id: catForm.store_id || null,
        },
      });
      toast.success("Category saved");
      setCatForm(null);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
  }

  async function submitCoupon(e: React.FormEvent) {
    e.preventDefault();
    try {
      await saveCoupon({
        data: {
          code: couponForm.code.trim(),
          discount_type: couponForm.discount_type,
          discount_value: Number(couponForm.discount_value) || 0,
          min_order_bdt: Number(couponForm.min_order_bdt) || 0,
          active: !!couponForm.active,
        },
      });
      toast.success("Coupon saved");
      setCouponForm(null);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
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
      toast.success("Store saved");
      setStoreForm(null);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    }
  }

  async function removeStore(id: string) {
    try {
      await deleteStore({ data: { id } });
      toast.success("Store deleted");
      setStoreForm(null);
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Delete failed");
    }
  }

  async function toggleOrder(id: string) {
    if (openOrder === id) {
      setOpenOrder(null);
      return;
    }
    setOpenOrder(id);
    if (!orderItems[id]) {
      try {
        const rows = await getOrderItems({ data: { orderId: id } });
        setOrderItems((m) => ({ ...m, [id]: rows }));
      } catch (e: any) {
        toast.error(e.message);
      }
    }
  }

  async function toggleAdmin(c: any) {
    if (
      !confirm(
        c.is_admin ? `Remove admin access from ${c.email}?` : `Give admin access to ${c.email}?`,
      )
    )
      return;
    try {
      await setAdminRole({ data: { userId: c.id, admin: !c.is_admin } });
      toast.success("Role updated");
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function removeReview(id: string) {
    if (!confirm("Delete this review?")) return;
    try {
      await deleteReview({ data: { id } });
      toast.success("Review deleted");
      reload();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  if (!ready)
    return (
      <AppShell>
        <div className="p-8 text-sm">Checking access…</div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl">Admin panel</h1>
          <Link to="/" className="text-sm text-brand">
            ← Back to store
          </Link>
        </div>
        <div className="mt-4 flex gap-2 border-b -mx-4 px-4 overflow-x-auto">
          {(
            [
              "dash",
              "orders",
              "reports",
              "assistant",
              "products",
              "categories",
              "coupons",
              "stores",
              "customers",
              "reviews",
              "marketing",
            ] as const
          ).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap px-4 py-2 text-sm capitalize border-b-2 ${tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground"}`}
            >
              {t === "dash" ? "Dashboard" : t === "assistant" ? "AI assistant" : t}
            </button>
          ))}
        </div>

        {tab === "reports" && <ReportsPanel />}
        {tab === "assistant" && <AssistantPanel />}

        {tab === "dash" && (
          <div className="mt-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat
                icon={TrendingUp}
                label="Revenue (excl. cancelled)"
                value={bdt(stats.revenue || 0)}
              />
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
                    <li key={o.id} className="py-2 flex justify-between gap-2">
                      <span className="font-mono text-xs">
                        {o.order_number}
                        <span className="ml-2 font-sans text-muted-foreground">
                          {o.customer_name}
                        </span>
                      </span>
                      <span>
                        {bdt(o.total_bdt)} · <span className="capitalize">{o.status}</span>
                      </span>
                    </li>
                  ))}
                  {!orders.length && <li className="py-2 text-muted-foreground">No orders yet.</li>}
                </ul>
              </section>
              <section className="rounded-2xl border bg-card p-4">
                <h2 className="font-semibold">Low stock</h2>
                <ul className="mt-2 divide-y text-sm">
                  {products
                    .filter((p) => p.stock <= 5)
                    .slice(0, 8)
                    .map((p) => (
                      <li key={p.id} className="py-2 flex justify-between">
                        <span className="line-clamp-1">{p.name}</span>
                        <span className={p.stock === 0 ? "text-destructive" : ""}>
                          {p.stock} left
                        </span>
                      </li>
                    ))}
                  {!products.some((p) => p.stock <= 5) && (
                    <li className="py-2 text-muted-foreground">All products well stocked.</li>
                  )}
                </ul>
              </section>
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="mt-6 space-y-3">
            <div className="flex flex-wrap gap-2">
              <input
                value={orderQ}
                onChange={(e) => setOrderQ(e.target.value)}
                placeholder="Search order no, name, phone or tracking"
                aria-label="Search orders"
                className="flex-1 min-w-48 rounded-xl border px-3 py-2 text-sm bg-background"
              />
              <select
                value={orderFilter}
                onChange={(e) => setOrderFilter(e.target.value)}
                aria-label="Filter by status"
                className="rounded-xl border px-3 py-2 text-sm bg-background"
              >
                {[
                  "all",
                  "pending",
                  "confirmed",
                  "shipped",
                  "delivered",
                  "returned",
                  "cancelled",
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                value={payFilter}
                onChange={(e) => setPayFilter(e.target.value)}
                aria-label="Filter by payment"
                className="rounded-xl border px-3 py-2 text-sm bg-background"
              >
                {["all", "cod", "awaiting", "verifying", "paid", "failed"].map((s) => (
                  <option key={s} value={s}>
                    {s === "all" ? "all payments" : s}
                  </option>
                ))}
              </select>
              <select
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                aria-label="Filter by zone"
                className="rounded-xl border px-3 py-2 text-sm bg-background"
              >
                <option value="all">all zones</option>
                {[...new Set(orders.map((o) => o.delivery_zone))].map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={orderFrom}
                onChange={(e) => setOrderFrom(e.target.value)}
                aria-label="From date"
                className="rounded-xl border px-3 py-2 text-sm bg-background"
              />
              <input
                type="date"
                value={orderTo}
                onChange={(e) => setOrderTo(e.target.value)}
                aria-label="To date"
                className="rounded-xl border px-3 py-2 text-sm bg-background"
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {["pending", "confirmed", "shipped", "delivered", "returned", "cancelled"].map(
                (s) => (
                  <button
                    key={s}
                    onClick={() => setOrderFilter(orderFilter === s ? "all" : s)}
                    className={`rounded-full border px-3 py-1 capitalize ${orderFilter === s ? "bg-brand text-brand-foreground" : "bg-card"}`}
                  >
                    {s} · {orders.filter((o) => o.status === s).length}
                  </button>
                ),
              )}
            </div>
            {selected.size > 0 && (
              <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-2xl border-2 border-brand bg-brand-soft/30 p-3 text-sm">
                <span className="font-semibold">{selected.size} অর্ডার সিলেক্ট করা আছে</span>
                <button
                  disabled={bulkBusy}
                  onClick={() =>
                    runBulk(
                      (ids) =>
                        bulkDispatchToCourier({ data: { orderIds: ids, courier: "Steadfast" } }),
                      "Steadfast-এ পাঠানো হয়েছে",
                    )
                  }
                  className="rounded-full border bg-background px-3 py-1.5 font-medium disabled:opacity-50"
                >
                  🚚 Send to Steadfast
                </button>
                <button
                  disabled={bulkBusy}
                  onClick={() =>
                    runBulk(
                      (ids) =>
                        bulkDispatchToCourier({ data: { orderIds: ids, courier: "Pathao" } }),
                      "Pathao-তে পাঠানো হয়েছে",
                    )
                  }
                  className="rounded-full border bg-background px-3 py-1.5 font-medium disabled:opacity-50"
                >
                  🚚 Send to Pathao
                </button>
                <button
                  disabled={bulkBusy}
                  onClick={() =>
                    runBulk(
                      (ids) => bulkUpdateOrderStatus({ data: { ids, status: "shipped" } }),
                      "Marked as shipped",
                    )
                  }
                  className="rounded-full border bg-background px-3 py-1.5 font-medium disabled:opacity-50"
                >
                  ✓ Mark as shipped
                </button>
                <button
                  disabled={bulkBusy}
                  onClick={() =>
                    runBulk(
                      (ids) => bulkUpdateOrderStatus({ data: { ids, status: "confirmed" } }),
                      "Marked as confirmed",
                    )
                  }
                  className="rounded-full border bg-background px-3 py-1.5 font-medium disabled:opacity-50"
                >
                  ✓ Mark as confirmed
                </button>
                <button
                  disabled={bulkBusy}
                  onClick={async () => {
                    const ids = [...selected];
                    const rows = orders.filter((o) => ids.includes(o.id));
                    const entries = await Promise.all(
                      rows.map(async (o) => ({
                        order: o,
                        items:
                          orderItems[o.id] ?? (await getOrderItems({ data: { orderId: o.id } })),
                      })),
                    );
                    entries.forEach((e, i) =>
                      setTimeout(() => printInvoice(e.order, e.items, "pos"), i * 300),
                    );
                  }}
                  className="rounded-full border bg-background px-3 py-1.5 font-medium disabled:opacity-50"
                >
                  🧾 Print POS slips
                </button>
                <button
                  disabled={bulkBusy}
                  onClick={() => setSelected(new Set())}
                  className="ml-auto text-muted-foreground underline"
                >
                  Clear
                </button>
              </div>
            )}
            <div className="rounded-2xl border overflow-x-auto bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all orders"
                        checked={
                          selected.size > 0 &&
                          orders
                            .filter((o) => {
                              if (orderFilter !== "all" && o.status !== orderFilter) return false;
                              if (
                                payFilter === "cod"
                                  ? o.payment_method !== "cod"
                                  : payFilter !== "all" &&
                                    (o.payment_method === "cod" || o.payment_status !== payFilter)
                              )
                                return false;
                              if (zoneFilter !== "all" && o.delivery_zone !== zoneFilter)
                                return false;
                              const d = o.created_at.slice(0, 10);
                              if (orderFrom && d < orderFrom) return false;
                              if (orderTo && d > orderTo) return false;
                              return `${o.order_number} ${o.customer_name} ${o.customer_phone} ${o.tracking_number ?? ""}`
                                .toLowerCase()
                                .includes(orderQ.toLowerCase());
                            })
                            .every((o) => selected.has(o.id))
                        }
                        onChange={(e) => {
                          const visible = orders.filter((o) => {
                            if (orderFilter !== "all" && o.status !== orderFilter) return false;
                            if (
                              payFilter === "cod"
                                ? o.payment_method !== "cod"
                                : payFilter !== "all" &&
                                  (o.payment_method === "cod" || o.payment_status !== payFilter)
                            )
                              return false;
                            if (zoneFilter !== "all" && o.delivery_zone !== zoneFilter)
                              return false;
                            const d = o.created_at.slice(0, 10);
                            if (orderFrom && d < orderFrom) return false;
                            if (orderTo && d > orderTo) return false;
                            return `${o.order_number} ${o.customer_name} ${o.customer_phone} ${o.tracking_number ?? ""}`
                              .toLowerCase()
                              .includes(orderQ.toLowerCase());
                          });
                          setSelected(
                            e.target.checked ? new Set(visible.map((o) => o.id)) : new Set(),
                          );
                        }}
                        className="h-4 w-4 accent-[--color-brand]"
                      />
                    </th>
                    <th className="p-3">Order</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders
                    .filter((o) => {
                      if (orderFilter !== "all" && o.status !== orderFilter) return false;
                      if (
                        payFilter === "cod"
                          ? o.payment_method !== "cod"
                          : payFilter !== "all" &&
                            (o.payment_method === "cod" || o.payment_status !== payFilter)
                      )
                        return false;
                      if (zoneFilter !== "all" && o.delivery_zone !== zoneFilter) return false;
                      const d = o.created_at.slice(0, 10);
                      if (orderFrom && d < orderFrom) return false;
                      if (orderTo && d > orderTo) return false;
                      return `${o.order_number} ${o.customer_name} ${o.customer_phone} ${o.tracking_number ?? ""}`
                        .toLowerCase()
                        .includes(orderQ.toLowerCase());
                    })
                    .map((o) => (
                      <Fragment key={o.id}>
                        <tr className={selected.has(o.id) ? "bg-brand-soft/20" : ""}>
                          <td className="p-3 align-top">
                            <input
                              type="checkbox"
                              aria-label={`Select ${o.order_number}`}
                              checked={selected.has(o.id)}
                              onChange={() => toggleSelect(o.id)}
                              className="h-4 w-4 accent-[--color-brand]"
                            />
                          </td>
                          <td className="p-3 font-mono text-xs">
                            {o.order_number}
                            <div className="text-muted-foreground">
                              {new Date(o.created_at).toLocaleDateString()}
                            </div>
                            <button
                              onClick={() => toggleOrder(o.id)}
                              className="mt-1 font-sans text-brand underline"
                            >
                              {openOrder === o.id ? "Hide details" : "Details"}
                            </button>
                          </td>
                          <td className="p-3">
                            {o.customer_name}
                            <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                            {(riskByPhone.get(phoneOf(o))?.blocked ||
                              (o.risk_score ?? 0) >= 40) && (
                              <div
                                className="mt-1 inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive"
                                title={
                                  o.risk_note ??
                                  riskByPhone.get(phoneOf(o))?.note ??
                                  "High return history"
                                }
                              >
                                ⚠{" "}
                                {riskByPhone.get(phoneOf(o))?.blocked
                                  ? "Blocked"
                                  : `Risk ${o.risk_score}`}
                              </div>
                            )}
                          </td>
                          <td className="p-3 font-semibold">
                            {bdt(o.total_bdt)}
                            {o.payment_method !== "cod" && (
                              <div className="text-xs font-normal text-muted-foreground">
                                {o.payment_method} · {o.payment_status}
                                {o.payment_ref ? ` · ${o.payment_ref}` : ""}
                                {o.payment_status === "verifying" && (
                                  <span className="ml-1 inline-flex gap-1">
                                    <button
                                      onClick={() => setPayment(o.id, "paid")}
                                      className="text-brand underline"
                                    >
                                      Mark paid
                                    </button>
                                    <button
                                      onClick={() => setPayment(o.id, "failed")}
                                      className="text-destructive underline"
                                    >
                                      Reject
                                    </button>
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <select
                              value={o.status}
                              onChange={(e) => updateStatus(o.id, e.target.value)}
                              aria-label="Order status"
                              className="rounded-full border px-2 py-1 text-xs bg-background"
                            >
                              {[
                                "pending",
                                "confirmed",
                                "shipped",
                                "delivered",
                                "returned",
                                "cancelled",
                              ].map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                        {openOrder === o.id && (
                          <tr>
                            <td colSpan={4} className="p-3 bg-muted/50 text-xs">
                              <div className="flex flex-wrap gap-2 mb-2">
                                <button
                                  type="button"
                                  disabled={!orderItems[o.id]}
                                  onClick={() => printInvoice(o, orderItems[o.id] ?? [], "a4")}
                                  className="rounded-full border bg-background px-3 py-1.5 font-medium disabled:opacity-50"
                                >
                                  🖨 A4 Invoice
                                </button>
                                <button
                                  type="button"
                                  disabled={!orderItems[o.id]}
                                  onClick={() => printInvoice(o, orderItems[o.id] ?? [], "pos")}
                                  className="rounded-full border bg-background px-3 py-1.5 font-medium disabled:opacity-50"
                                >
                                  🧾 POS Slip (80mm)
                                </button>
                              </div>
                              <DeliveryProgress order={o} />
                              <DeliveryForm order={o} onSaved={reload} />
                              <CourierSmsPanel
                                order={o}
                                risk={riskByPhone.get(phoneOf(o)) ?? null}
                                onDone={reload}
                              />
                              <div className="grid sm:grid-cols-2 gap-3 mt-3">
                                <div>
                                  <div className="font-semibold">Delivery</div>
                                  <div>
                                    {o.address_line}, {o.city}
                                    {o.district ? `, ${o.district}` : ""}
                                  </div>
                                  <div>
                                    Zone: {o.delivery_zone}
                                    {o.guest_email ? ` · ${o.guest_email}` : ""}
                                  </div>
                                  {o.notes && <div>Note: {o.notes}</div>}
                                  <div className="mt-1">
                                    Subtotal {bdt(o.subtotal_bdt)} · Shipping {bdt(o.shipping_bdt)}{" "}
                                    · Discount {bdt(o.discount_bdt)}
                                    {o.coupon_code ? ` (${o.coupon_code})` : ""}
                                  </div>
                                </div>
                                <ul className="space-y-1">
                                  {(orderItems[o.id] ?? []).map((it: any) => (
                                    <li key={it.id} className="flex justify-between gap-2">
                                      <span>
                                        {it.product_name}
                                        {it.variant_label ? ` (${it.variant_label})` : ""} ×{" "}
                                        {it.qty}
                                      </span>
                                      <span>{bdt(it.unit_price_bdt * it.qty)}</span>
                                    </li>
                                  ))}
                                  {!orderItems[o.id] && <li>Loading…</li>}
                                </ul>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                </tbody>
              </table>
              {!orders.length && (
                <div className="p-8 text-center text-muted-foreground text-sm">No orders yet.</div>
              )}
            </div>
          </div>
        )}

        {tab === "products" && (
          <div className="mt-6 space-y-4">
            <button
              onClick={() => openProduct(null)}
              className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              New product
            </button>
            <div className="rounded-2xl border overflow-hidden bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3">Price</th>
                    <th className="p-3">Stock</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="p-3">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.slug}</div>
                      </td>
                      <td className="p-3">{bdt(p.price_bdt)}</td>
                      <td className="p-3">
                        <input
                          type="number"
                          aria-label="Stock"
                          defaultValue={p.stock}
                          onBlur={(e) => updateStock(p.id, parseInt(e.target.value) || 0)}
                          className="w-20 rounded-lg border px-2 py-1 text-sm bg-background"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <button onClick={() => openProduct(p)} className="text-xs text-brand">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editing && (
              <form onSubmit={submitProduct} className="rounded-2xl border bg-card p-4 space-y-3">
                <h2 className="font-semibold">{editing.id ? "Edit product" : "New product"}</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <F
                    label="Name"
                    value={editing.name}
                    onChange={(v) => setEditing({ ...editing, name: v })}
                    required
                  />
                  <F
                    label="Slug"
                    value={editing.slug}
                    onChange={(v) => setEditing({ ...editing, slug: v })}
                    required
                  />
                  <F
                    label="Price (৳)"
                    type="number"
                    value={editing.price_bdt}
                    onChange={(v) => setEditing({ ...editing, price_bdt: v })}
                    required
                  />
                  <F
                    label="Compare price (৳)"
                    type="number"
                    value={editing.compare_price_bdt ?? ""}
                    onChange={(v) => setEditing({ ...editing, compare_price_bdt: v })}
                  />
                  <F
                    label="Stock"
                    type="number"
                    value={editing.stock}
                    onChange={(v) => setEditing({ ...editing, stock: v })}
                    required
                  />
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Category</span>
                    <select
                      value={editing.category_id ?? ""}
                      onChange={(e) =>
                        setEditing({ ...editing, category_id: e.target.value || null })
                      }
                      className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background"
                    >
                      <option value="">— none —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Store / brand</span>
                    <select
                      value={editing.store_id ?? ""}
                      onChange={(e) => setEditing({ ...editing, store_id: e.target.value || null })}
                      className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background"
                    >
                      <option value="">— none —</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <GalleryField
                    value={
                      Array.isArray(editing.images)
                        ? editing.images
                        : String(editing.images || "")
                            .split(",")
                            .map((s: string) => s.trim())
                            .filter(Boolean)
                    }
                    onChange={(v) => setEditing({ ...editing, images: v })}
                  />
                  <F
                    label="Video URL"
                    value={editing.video_url ?? ""}
                    onChange={(v) => setEditing({ ...editing, video_url: v })}
                    className="sm:col-span-2"
                  />
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-muted-foreground">Description</span>
                    <textarea
                      value={editing.description ?? ""}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                      rows={3}
                      className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background"
                    />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-muted-foreground">Specs</span>
                    <textarea
                      value={editing.specs ?? ""}
                      onChange={(e) => setEditing({ ...editing, specs: e.target.value })}
                      rows={2}
                      className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background"
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  {(
                    [
                      ["is_featured", "Featured"],
                      ["is_new", "New"],
                      ["is_flash_sale", "Flash sale"],
                    ] as const
                  ).map(([k, label]) => (
                    <label key={k} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!editing[k]}
                        onChange={(e) => setEditing({ ...editing, [k]: e.target.checked })}
                        className="accent-[--color-brand]"
                      />
                      {label}
                    </label>
                  ))}
                  {editing.is_flash_sale && (
                    <F
                      label="Flash price (৳)"
                      type="number"
                      value={editing.flash_price_bdt ?? ""}
                      onChange={(v) => setEditing({ ...editing, flash_price_bdt: v })}
                    />
                  )}
                </div>

                <div className="rounded-xl border p-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Variants</h3>
                    <button
                      type="button"
                      onClick={addVariant}
                      className="ml-auto rounded-full border px-3 py-1 text-xs"
                    >
                      Add variant
                    </button>
                  </div>
                  {!variants.length ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No variants. Save the product first, then add sizes or colours.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {variants.map((v) => (
                        <li
                          key={v.id}
                          className="grid grid-cols-[1fr,1fr,90px,80px,32px] gap-2 items-center"
                        >
                          <input
                            defaultValue={v.option_group}
                            aria-label="Option group"
                            onBlur={(e) => patchVariant(v, { option_group: e.target.value })}
                            className="rounded-lg border px-2 py-1 text-xs bg-background"
                          />
                          <input
                            defaultValue={v.label}
                            aria-label="Variant label"
                            onBlur={(e) => patchVariant(v, { label: e.target.value })}
                            className="rounded-lg border px-2 py-1 text-xs bg-background"
                          />
                          <input
                            type="number"
                            defaultValue={v.price_delta_bdt}
                            aria-label="Price delta"
                            onBlur={(e) => patchVariant(v, { price_delta_bdt: e.target.value })}
                            className="rounded-lg border px-2 py-1 text-xs bg-background"
                          />
                          <input
                            type="number"
                            defaultValue={v.stock}
                            aria-label="Variant stock"
                            onBlur={(e) => patchVariant(v, { stock: e.target.value })}
                            className="rounded-lg border px-2 py-1 text-xs bg-background"
                          />
                          <button
                            type="button"
                            onClick={() => removeVariant(v)}
                            aria-label="Delete variant"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex gap-2">
                  <button className="rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm font-medium">
                    Save product
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-full border px-5 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  {editing.id && (
                    <button
                      type="button"
                      onClick={() => removeProduct(editing.id)}
                      className="ml-auto rounded-full border border-destructive text-destructive px-5 py-2 text-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {tab === "categories" && (
          <div className="mt-6 space-y-4">
            <button
              onClick={() => setCatForm({ slug: "", name: "", image_url: "", sort_order: 0 })}
              className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              New category
            </button>
            <ul className="rounded-2xl border bg-card divide-y">
              {categories.map((c) => (
                <li key={c.id} className="p-3 flex items-center gap-3 text-sm">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.slug}</div>
                  </div>
                  <button onClick={() => setCatForm(c)} className="ml-auto text-xs text-brand">
                    Edit
                  </button>
                </li>
              ))}
            </ul>
            {catForm && (
              <form onSubmit={submitCategory} className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <F
                    label="Name"
                    value={catForm.name}
                    onChange={(v) => setCatForm({ ...catForm, name: v })}
                    required
                  />
                  <F
                    label="Slug"
                    value={catForm.slug}
                    onChange={(v) => setCatForm({ ...catForm, slug: v })}
                    required
                  />
                  <ImageField
                    label="Category photo"
                    folder="categories"
                    value={catForm.image_url ?? ""}
                    onChange={(v) => setCatForm({ ...catForm, image_url: v })}
                  />
                  <F
                    label="Sort order"
                    type="number"
                    value={catForm.sort_order ?? 0}
                    onChange={(v) => setCatForm({ ...catForm, sort_order: v })}
                  />
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Store / brand</span>
                    <select
                      value={catForm.store_id ?? ""}
                      onChange={(e) => setCatForm({ ...catForm, store_id: e.target.value || null })}
                      className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background"
                    >
                      <option value="">— none —</option>
                      {stores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm font-medium">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setCatForm(null)}
                    className="rounded-full border px-5 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  {catForm.id && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (
                          !confirm(
                            "Delete this category? Its products stay but become uncategorised.",
                          )
                        )
                          return;
                        try {
                          await deleteCategory({ data: { id: catForm.id } });
                          toast.success("Category deleted");
                          setCatForm(null);
                          reload();
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                      className="ml-auto rounded-full border border-destructive text-destructive px-5 py-2 text-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {tab === "coupons" && (
          <div className="mt-6 space-y-4">
            <button
              onClick={() =>
                setCouponForm({
                  code: "",
                  discount_type: "percent",
                  discount_value: 10,
                  min_order_bdt: 0,
                  active: true,
                })
              }
              className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              New coupon
            </button>
            <ul className="space-y-2">
              {coupons.map((c) => (
                <li
                  key={c.code}
                  className="flex items-center justify-between rounded-xl bg-muted p-3"
                >
                  <div>
                    <div className="font-mono font-semibold">{c.code}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.discount_type === "percent"
                        ? `${c.discount_value}% off`
                        : `৳${c.discount_value} off`}{" "}
                      · min order ৳{c.min_order_bdt}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${c.active ? "bg-brand text-brand-foreground" : "bg-muted-foreground/20"}`}
                    >
                      {c.active ? "active" : "inactive"}
                    </span>
                    <button onClick={() => setCouponForm(c)} className="text-xs text-brand">
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        await deleteCoupon({ data: { code: c.code } });
                        toast.success("Deleted");
                        reload();
                      }}
                      aria-label="Delete coupon"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {couponForm && (
              <form onSubmit={submitCoupon} className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <F
                    label="Code"
                    value={couponForm.code}
                    onChange={(v) => setCouponForm({ ...couponForm, code: v.toUpperCase() })}
                    required
                  />
                  <label className="block">
                    <span className="text-xs text-muted-foreground">Type</span>
                    <select
                      value={couponForm.discount_type}
                      onChange={(e) =>
                        setCouponForm({ ...couponForm, discount_type: e.target.value })
                      }
                      className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background"
                    >
                      <option value="percent">Percent</option>
                      <option value="flat">Flat ৳</option>
                    </select>
                  </label>
                  <F
                    label="Value"
                    type="number"
                    value={couponForm.discount_value}
                    onChange={(v) => setCouponForm({ ...couponForm, discount_value: v })}
                    required
                  />
                  <F
                    label="Minimum order (৳)"
                    type="number"
                    value={couponForm.min_order_bdt}
                    onChange={(v) => setCouponForm({ ...couponForm, min_order_bdt: v })}
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!couponForm.active}
                    onChange={(e) => setCouponForm({ ...couponForm, active: e.target.checked })}
                    className="accent-[--color-brand]"
                  />
                  Active
                </label>
                <div className="flex gap-2">
                  <button className="rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm font-medium">
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setCouponForm(null)}
                    className="rounded-full border px-5 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {tab === "stores" && (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Each store is a separate brand (baby, beauty, kitchen…) sharing this admin panel,
              inventory and customer base.
            </p>
            <button
              onClick={() => setStoreForm({ ...emptyStore })}
              className="inline-flex items-center gap-2 rounded-full bg-brand text-brand-foreground px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              New store
            </button>
            <ul className="rounded-2xl border bg-card divide-y">
              {stores.map((s) => (
                <li key={s.id} className="p-3 flex items-center gap-3 text-sm">
                  <div
                    className="h-8 w-8 rounded-lg shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${s.theme_color}, ${s.accent_color})`,
                    }}
                  />
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      /store/{s.slug} · {products.filter((p) => p.store_id === s.id).length}{" "}
                      products
                    </div>
                  </div>
                  <span
                    className={`ml-auto text-xs px-2 py-0.5 rounded-full ${s.active ? "bg-brand text-brand-foreground" : "bg-muted-foreground/20"}`}
                  >
                    {s.active ? "active" : "hidden"}
                  </span>
                  <button onClick={() => setStoreForm(s)} className="text-xs text-brand">
                    Edit
                  </button>
                </li>
              ))}
            </ul>
            {storeForm && (
              <form onSubmit={submitStore} className="rounded-2xl border bg-card p-4 space-y-3">
                <h2 className="font-semibold">{storeForm.id ? "Edit store" : "New store"}</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  <F
                    label="Name"
                    value={storeForm.name}
                    onChange={(v) => setStoreForm({ ...storeForm, name: v })}
                    required
                  />
                  <F
                    label="Slug (url)"
                    value={storeForm.slug}
                    onChange={(v) => setStoreForm({ ...storeForm, slug: v })}
                    required
                  />
                  <F
                    label="Tagline"
                    value={storeForm.tagline ?? ""}
                    onChange={(v) => setStoreForm({ ...storeForm, tagline: v })}
                    className="sm:col-span-2"
                  />
                  <F
                    label="Primary colour"
                    value={storeForm.theme_color}
                    onChange={(v) => setStoreForm({ ...storeForm, theme_color: v })}
                  />
                  <F
                    label="Accent colour"
                    value={storeForm.accent_color}
                    onChange={(v) => setStoreForm({ ...storeForm, accent_color: v })}
                  />
                  <ImageField
                    label="Logo"
                    folder="stores"
                    value={storeForm.logo_url ?? ""}
                    onChange={(v) => setStoreForm({ ...storeForm, logo_url: v })}
                  />
                  <F
                    label="Sort order"
                    type="number"
                    value={storeForm.sort_order ?? 0}
                    onChange={(v) => setStoreForm({ ...storeForm, sort_order: v })}
                  />
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-muted-foreground">Description</span>
                    <textarea
                      value={storeForm.description ?? ""}
                      onChange={(e) => setStoreForm({ ...storeForm, description: e.target.value })}
                      rows={2}
                      className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background"
                    />
                  </label>
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!storeForm.active}
                    onChange={(e) => setStoreForm({ ...storeForm, active: e.target.checked })}
                    className="accent-[--color-brand]"
                  />
                  Visible to shoppers
                </label>
                <div className="flex gap-2">
                  <button className="rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm font-medium">
                    Save store
                  </button>
                  <button
                    type="button"
                    onClick={() => setStoreForm(null)}
                    className="rounded-full border px-5 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  {storeForm.id && storeForm.slug !== "home" && (
                    <button
                      type="button"
                      onClick={() => removeStore(storeForm.id)}
                      className="ml-auto rounded-full border border-destructive text-destructive px-5 py-2 text-sm"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        )}

        {tab === "marketing" && (
          <div className="mt-6 grid md:grid-cols-2 gap-4">
            <section className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-brand" />
                <h2 className="font-semibold">Back-in-stock requests</h2>
              </div>
              {!alerts.length ? (
                <p className="mt-3 text-sm text-muted-foreground">No requests yet.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {alerts.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded-xl bg-muted p-2">
                      <div className="min-w-0">
                        <div className="font-medium line-clamp-1">
                          {a.products?.name ?? "Product"}
                        </div>
                        <div className="text-xs text-muted-foreground">{a.email ?? a.phone}</div>
                      </div>
                      <span
                        className={`ml-auto text-xs px-2 py-0.5 rounded-full ${a.notified ? "bg-brand text-brand-foreground" : "bg-muted-foreground/20"}`}
                      >
                        {a.notified ? "notified" : "waiting"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Alerts are sent automatically when you set stock above zero.
              </p>
            </section>

            <section className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">Abandoned carts</h2>
                <button
                  disabled={bulkBusy}
                  onClick={runNudges}
                  className="rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50"
                  title="সব ১ ঘণ্টা পুরনো কার্টে অটো SMS + কুপন পাঠান"
                >
                  ▶ Run SMS recovery now
                </button>
              </div>
              {!carts.length ? (
                <p className="mt-3 text-sm text-muted-foreground">No abandoned carts.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {carts.map((c) => (
                    <li key={c.id} className="flex items-center gap-2 rounded-xl bg-muted p-2">
                      <div className="min-w-0">
                        <div className="font-medium">{bdt(c.subtotal_bdt)}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          {c.contact ?? "no contact"} ·{" "}
                          {new Date(c.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="ml-auto text-right">
                        {c.nudged_at && (
                          <div className="text-[10px] text-brand">
                            ↩ nudged {new Date(c.nudged_at).toLocaleDateString()}
                            {c.discount_code ? ` · ${c.discount_code}` : ""}
                          </div>
                        )}
                        <button
                          disabled={!c.contact}
                          onClick={async () => {
                            try {
                              await sendCartReminder({ data: { id: c.id } });
                              toast.success("Reminder queued");
                              reload();
                            } catch (e: any) {
                              toast.error(e.message);
                            }
                          }}
                          className="rounded-full border px-3 py-1 text-xs disabled:opacity-40"
                        >
                          Send reminder
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-4 md:col-span-2">
              <h2 className="font-semibold">Courier fraud watchlist (phone risk)</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                যেকোনো অর্ডার “returned” বা “cancelled” করলে ফোন নম্বরের স্কোর অটো বাড়ে। ৪০+ স্কোর
                হলে চেকআউটে ও ডিসপ্যাচ প্যানেলে সতর্কতা দেখায়; “Block” করলে সেই নম্বরে COD অর্ডার
                ব্লক হয়ে যায়।
              </p>
              {phoneRisk.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  কোনো ঝুঁকিপূর্ণ নম্বর নেই — ভালো খবর! 🎉
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {phoneRisk.slice(0, 20).map((r) => (
                    <li
                      key={r.phone}
                      className={`flex flex-wrap items-center gap-2 rounded-xl p-2 ${r.blocked ? "bg-destructive/10" : "bg-muted"}`}
                    >
                      <span className="font-mono">{r.phone}</span>
                      <span className="text-xs text-muted-foreground">
                        ↩ {r.returned_count} returns · ✕ {r.cancelled_count} cancels ·{" "}
                        {r.order_count} orders
                      </span>
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.returned_count * 40 + r.cancelled_count * 15 >= 40 ? "bg-destructive text-destructive-foreground" : "bg-muted-foreground/20"}`}
                      >
                        risk {Math.min(100, r.returned_count * 40 + r.cancelled_count * 15)}
                      </span>
                      <button
                        onClick={() => setRisk(r.phone, { blocked: !r.blocked })}
                        className={`rounded-full border px-3 py-0.5 text-xs ${r.blocked ? "border-destructive text-destructive" : ""}`}
                      >
                        {r.blocked ? " Unblock" : "Block"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-4 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">Bundle deals (frequently bought together)</h2>
                <button
                  onClick={() =>
                    setBundleForm({
                      productId: "",
                      withProductId: "",
                      discountBdt: "",
                      active: true,
                    })
                  }
                  className="rounded-full border px-3 py-1 text-xs font-medium"
                >
                  + New bundle
                </button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                একসাথে দুটি পণ্য কিনলে চেকআউটে এই ছাড়টি অটো প্রযোজ্য হবে এবং প্রোডাক্ট পেজে “সাথে
                কিনুন” কার্ড হিসেবে দেখাবে।
              </p>
              {bundles.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm">
                  {bundles.map((b) => (
                    <li
                      key={b.id}
                      className="flex flex-wrap items-center gap-2 rounded-xl bg-muted p-2"
                    >
                      <span className="line-clamp-1">
                        {products.find((p) => p.id === b.product_id)?.name ?? "—"}
                      </span>
                      <span className="text-muted-foreground">+</span>
                      <span className="line-clamp-1">
                        {products.find((p) => p.id === b.with_product_id)?.name ?? "—"}
                      </span>
                      <span className="ml-auto text-xs font-semibold text-brand">
                        -{bdt(b.discount_bdt)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${b.active ? "bg-brand text-brand-foreground" : "bg-muted-foreground/20"}`}
                      >
                        {b.active ? "active" : "off"}
                      </span>
                      <button
                        onClick={() => removeBundle(b.id)}
                        className="text-xs text-destructive"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!bundles.length && (
                <p className="mt-3 text-sm text-muted-foreground">No bundles configured yet.</p>
              )}
              {bundleForm && (
                <div className="mt-3 grid gap-2 rounded-xl border bg-background p-3 sm:grid-cols-2">
                  <select
                    value={bundleForm.productId}
                    onChange={(e) => setBundleForm({ ...bundleForm, productId: e.target.value })}
                    className="h-9 rounded-lg border bg-background px-2 text-sm"
                  >
                    <option value="">পণ্য ১ নির্বাচন করুন</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={bundleForm.withProductId}
                    onChange={(e) =>
                      setBundleForm({ ...bundleForm, withProductId: e.target.value })
                    }
                    className="h-9 rounded-lg border bg-background px-2 text-sm"
                  >
                    <option value="">পণ্য ২ নির্বাচন করুন</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    placeholder="ছাড় ৳"
                    value={bundleForm.discountBdt}
                    onChange={(e) => setBundleForm({ ...bundleForm, discountBdt: e.target.value })}
                    className="h-9 rounded-lg border bg-background px-2 text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={bundleForm.active}
                      onChange={(e) => setBundleForm({ ...bundleForm, active: e.target.checked })}
                    />
                    Active
                  </label>
                  <div className="flex gap-2 sm:col-span-2">
                    <button
                      onClick={submitBundle}
                      className="rounded-full bg-brand px-4 py-1.5 text-xs font-semibold text-brand-foreground"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setBundleForm(null)}
                      className="rounded-full border px-4 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-card p-4 md:col-span-2">
              <h2 className="font-semibold">Recent messages</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {notifications.map((n) => (
                  <li key={n.id} className="rounded-xl bg-muted p-2">
                    <div className="font-medium line-clamp-1">{n.subject}</div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {n.channel} → {n.recipient} · {n.status}
                    </div>
                  </li>
                ))}
                {!notifications.length && (
                  <li className="text-sm text-muted-foreground">Nothing sent yet.</li>
                )}
              </ul>
            </section>
          </div>
        )}

        {tab === "customers" && (
          <div className="mt-6 space-y-3">
            <input
              value={custQ}
              onChange={(e) => setCustQ(e.target.value)}
              placeholder="Search name, email or phone"
              aria-label="Search customers"
              className="w-full sm:w-80 rounded-xl border px-3 py-2 text-sm bg-background"
            />
            <div className="rounded-2xl border overflow-x-auto bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Orders</th>
                    <th className="p-3">Spent</th>
                    <th className="p-3">Joined</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Access</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customers
                    .filter((c) =>
                      `${c.email} ${c.full_name ?? ""} ${c.phone ?? ""}`
                        .toLowerCase()
                        .includes(custQ.toLowerCase()),
                    )
                    .map((c) => (
                      <tr key={c.id}>
                        <td className="p-3">
                          <div className="font-medium">{c.full_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.email}
                            {c.phone ? ` · ${c.phone}` : ""}
                          </div>
                        </td>
                        <td className="p-3">{c.order_count}</td>
                        <td className="p-3">{bdt(c.spent_bdt)}</td>
                        <td className="p-3 text-xs">
                          {new Date(c.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => toggleAdmin(c)}
                            className={`rounded-full px-3 py-1 text-xs border ${c.is_admin ? "bg-brand text-brand-foreground border-brand" : ""}`}
                          >
                            {c.is_admin ? "Admin" : "Customer"}
                          </button>
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => toggleSessionRevocation(c.id, !c.sessions_revoked)}
                            title="ব্লক করলে অ্যাকাউন্টের সব সার্ভার-সাইড অ্যাকশন তৎক্ষণাৎ বন্ধ হবে (সেশন রিভোক)"
                            className={`rounded-full px-3 py-1 text-xs border ${c.sessions_revoked ? "border-destructive text-destructive" : ""}`}
                          >
                            {c.sessions_revoked ? "Blocked" : "Revoke"}
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!customers.length && (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  No customers yet.
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Click a role to switch between Customer and Admin. “Revoke” blocks every server-side
              action of that account immediately (use it for chargebacks, fraud or a compromised
              login — then reset their password).
            </p>
          </div>
        )}

        {tab === "reviews" && (
          <ul className="mt-6 rounded-2xl border bg-card divide-y">
            {reviews.map((r) => (
              <li key={r.id} className="p-3 flex gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">
                    {"★".repeat(r.rating)}
                    <span className="text-muted-foreground">{"★".repeat(5 - r.rating)}</span> ·{" "}
                    {r.author_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {r.products?.name ?? "Product"} · {new Date(r.created_at).toLocaleDateString()}
                  </div>
                  {r.comment && <p className="mt-1">{r.comment}</p>}
                </div>
                <button
                  onClick={() => removeReview(r.id)}
                  aria-label="Delete review"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
            {!reviews.length && (
              <li className="p-8 text-center text-muted-foreground text-sm">No reviews yet.</li>
            )}
          </ul>
        )}
      </div>
    </AppShell>
  );
}

function F({
  label,
  value,
  onChange,
  required,
  type,
  className,
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">
        {label}
        {required && " *"}
      </span>
      <input
        type={type ?? "text"}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background"
      />
    </label>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-display">{value}</div>
    </div>
  );
}

/* ---------------- Photo upload ---------------- */

async function fileToUpload(file: File, folder: "products" | "categories" | "stores") {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5 MB");
  const buf = new Uint8Array(await file.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 0x8000)
    bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  const { url } = await uploadImage({
    data: { folder, fileName: file.name, contentType: file.type, base64: btoa(bin) },
  });
  return url;
}

function ImageField({
  label,
  folder,
  value,
  onChange,
}: {
  label: string;
  folder: "categories" | "stores";
  value: string;
  onChange: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-3">
        {value ? (
          <img
            src={resolveImage(value)}
            alt=""
            className="h-14 w-14 rounded-xl object-cover border"
          />
        ) : (
          <div className="h-14 w-14 rounded-xl border bg-muted" />
        )}
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs">
          <Upload className="h-3.5 w-3.5" />
          {busy ? "Uploading…" : value ? "Change photo" : "Upload photo"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setBusy(true);
              try {
                onChange(await fileToUpload(f, folder));
                toast.success("Photo uploaded");
              } catch (err: any) {
                toast.error(err.message ?? "Upload failed");
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-xs text-destructive">
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function GalleryField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="sm:col-span-2 text-sm">
      <span className="text-muted-foreground">
        Product photos (first one is the main photo, up to 8)
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        {value.map((src, i) => (
          <div key={src + i} className="relative">
            <img
              src={resolveImage(src)}
              alt=""
              className="h-20 w-20 rounded-xl object-cover border"
            />
            <button
              type="button"
              aria-label="Remove photo"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
            {i > 0 && (
              <button
                type="button"
                onClick={() => onChange([src, ...value.filter((_, j) => j !== i)])}
                className="absolute bottom-0 inset-x-0 rounded-b-xl bg-background/80 text-[10px]"
              >
                Make main
              </button>
            )}
          </div>
        ))}
        {value.length < 8 && (
          <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-xs text-muted-foreground">
            <Upload className="h-4 w-4" />
            {busy ? "Uploading…" : "Add photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={busy}
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []).slice(0, 8 - value.length);
                e.target.value = "";
                if (!files.length) return;
                setBusy(true);
                const urls: string[] = [];
                for (const f of files) {
                  try {
                    urls.push(await fileToUpload(f, "products"));
                  } catch (err: any) {
                    toast.error(`${f.name}: ${err.message}`);
                  }
                }
                if (urls.length) {
                  onChange([...value, ...urls]);
                  toast.success(`${urls.length} photo(s) uploaded`);
                }
                setBusy(false);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

/* ---------------- Delivery ---------------- */

const STEPS = ["pending", "confirmed", "shipped", "delivered"];

function DeliveryProgress({ order }: { order: any }) {
  if (order.status === "cancelled")
    return (
      <div className="mb-2 rounded-lg bg-destructive/10 p-2 text-destructive font-medium">
        Order cancelled
      </div>
    );
  if (order.status === "returned")
    return (
      <div className="mb-2 rounded-lg bg-destructive/10 p-2 text-destructive font-medium">
        Order returned by courier
      </div>
    );
  const idx = STEPS.indexOf(order.status);
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= idx ? "bg-brand" : "bg-border"}`} />
            <div
              className={`mt-1 capitalize ${i <= idx ? "text-foreground font-medium" : "text-muted-foreground"}`}
            >
              {s}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 text-muted-foreground">
        Placed {new Date(order.created_at).toLocaleString()}
        {order.shipped_at && ` · Shipped ${new Date(order.shipped_at).toLocaleString()}`}
        {order.delivered_at && ` · Delivered ${new Date(order.delivered_at).toLocaleString()}`}
      </div>
    </div>
  );
}

function DeliveryForm({ order, onSaved }: { order: any; onSaved: () => void }) {
  const [f, setF] = useState({
    courier: order.courier ?? "",
    tracking_number: order.tracking_number ?? "",
    delivery_note: order.delivery_note ?? "",
  });
  const [busy, setBusy] = useState(false);
  return (
    <div className="grid gap-2 sm:grid-cols-4 items-end">
      <label>
        Courier
        <select
          value={f.courier}
          onChange={(e) => setF({ ...f, courier: e.target.value })}
          className="mt-1 w-full rounded-lg border px-2 py-1.5 bg-background"
        >
          {["", "Pathao", "Steadfast", "RedX", "Sundarban", "eCourier", "Own delivery"].map((c) => (
            <option key={c} value={c}>
              {c || "Select…"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tracking number
        <input
          value={f.tracking_number}
          onChange={(e) => setF({ ...f, tracking_number: e.target.value })}
          className="mt-1 w-full rounded-lg border px-2 py-1.5 bg-background"
        />
      </label>
      <label>
        Delivery note
        <input
          value={f.delivery_note}
          onChange={(e) => setF({ ...f, delivery_note: e.target.value })}
          className="mt-1 w-full rounded-lg border px-2 py-1.5 bg-background"
        />
      </label>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await saveOrderDelivery({
              data: {
                id: order.id,
                courier: f.courier || null,
                tracking_number: f.tracking_number || null,
                delivery_note: f.delivery_note || null,
              },
            });
            toast.success("Delivery info saved");
            onSaved();
          } catch (e: any) {
            toast.error(e.message ?? "Save failed");
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-full bg-brand text-brand-foreground px-4 py-2 font-medium"
      >
        {busy ? "Saving…" : "Save delivery info"}
      </button>
    </div>
  );
}

/* ---------------- Reports ---------------- */

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportsPanel() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(
    new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(today);
  const [rep, setRep] = useState<{ days: any[]; products: any[] } | null>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      setRep(await getSalesReport({ data: { from, to } }));
    } catch (e: any) {
      toast.error(e.message ?? "Report failed");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    run();
  }, []);
  const total = rep?.days.reduce((s, d) => s + d.revenue, 0) ?? 0;
  const count = rep?.days.reduce((s, d) => s + d.orders, 0) ?? 0;
  const max = Math.max(1, ...(rep?.days.map((d) => d.revenue) ?? [1]));
  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label>
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="ml-2 rounded-xl border px-3 py-2 bg-background"
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
            className="ml-2 rounded-xl border px-3 py-2 bg-background"
          />
        </label>
        <button
          onClick={run}
          disabled={busy}
          className="rounded-full bg-brand text-brand-foreground px-4 py-2 font-medium"
        >
          {busy ? "Loading…" : "Show report"}
        </button>
      </div>
      {rep && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={TrendingUp} label="Sales" value={bdt(total)} />
            <Stat icon={ShoppingBag} label="Orders" value={count} />
            <Stat
              icon={Package}
              label="Avg. order"
              value={bdt(count ? Math.round(total / count) : 0)}
            />
          </div>
          <section className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Sales by date</h2>
              <button
                onClick={() =>
                  downloadCsv(`sales-by-date_${from}_${to}.csv`, [
                    ["Date", "Orders", "Revenue (BDT)"],
                    ...rep.days.map((d) => [d.date, d.orders, d.revenue]),
                  ])
                }
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
            </div>
            <div className="mt-3 space-y-1 text-xs">
              {rep.days.map((d) => (
                <div key={d.date} className="flex items-center gap-2">
                  <span className="w-20 font-mono">{d.date.slice(5)}</span>
                  <div
                    className="h-3 rounded bg-brand"
                    style={{ width: `${(d.revenue / max) * 70}%` }}
                  />
                  <span>
                    {bdt(d.revenue)} · {d.orders}
                  </span>
                </div>
              ))}
              {!rep.days.length && (
                <div className="text-muted-foreground">No sales in this period.</div>
              )}
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Sales by product</h2>
              <button
                onClick={() =>
                  downloadCsv(`sales-by-product_${from}_${to}.csv`, [
                    ["Product", "Units sold", "Revenue (BDT)"],
                    ...rep.products.map((p) => [p.product, p.qty, p.revenue]),
                  ])
                }
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                CSV
              </button>
            </div>
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1">Product</th>
                  <th>Units</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rep.products.map((p) => (
                  <tr key={p.product}>
                    <td className="py-1.5">{p.product}</td>
                    <td>{p.qty}</td>
                    <td>{bdt(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

/* ---------------- AI assistant ---------------- */

function AssistantPanel() {
  const [q, setQ] = useState("");
  const [chat, setChat] = useState<{ q: string; a: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const examples = [
    "এই মাসে সবচেয়ে বেশি বিক্রি হওয়া ৫টি পণ্য কোনগুলো?",
    "Which products should I restock soon?",
    "গত ৭ দিনের বিক্রি আগের সপ্তাহের তুলনায় কেমন?",
    "How many orders are still pending or awaiting payment?",
  ];
  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setBusy(true);
    setQ("");
    try {
      const r = await askAssistant({ data: { question } });
      setChat((c) => [...c, { q: question, a: r.answer }]);
    } catch (e: any) {
      toast.error(e.message ?? "AI request failed");
      setQ(question);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-brand" />
          Ask about sales, orders and inventory
        </h2>
        <p className="text-sm text-muted-foreground">
          Answers use your last 90 days of orders and current stock.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {examples.map((e) => (
            <button
              key={e}
              onClick={() => ask(e)}
              disabled={busy}
              className="rounded-full border px-3 py-1 text-xs"
            >
              {e}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(q);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type your question…"
            aria-label="Question"
            className="flex-1 rounded-xl border px-3 py-2 text-sm bg-background"
          />
          <button
            disabled={busy}
            className="rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm font-medium"
          >
            {busy ? "Thinking…" : "Ask"}
          </button>
        </form>
      </div>
      {[...chat].reverse().map((m, i) => (
        <div key={i} className="rounded-2xl border bg-card p-4 text-sm">
          <div className="font-semibold">{m.q}</div>
          <div className="mt-2 whitespace-pre-wrap leading-relaxed">{m.a}</div>
        </div>
      ))}
    </div>
  );
}

type PhoneRiskRow = Awaited<ReturnType<typeof getPhoneRisk>>[number];

function CourierSmsPanel({
  order,
  risk,
  onDone,
}: {
  order: any;
  risk: PhoneRiskRow | null;
  onDone: () => void;
}) {
  const [log, setLog] = useState<{ dispatches: any[]; messages: any[] }>({
    dispatches: [],
    messages: [],
  });
  const [busy, setBusy] = useState(false);
  const load = () =>
    getOrderComms({ data: { orderId: order.id } })
      .then(setLog)
      .catch(() => {});
  useEffect(() => {
    load();
  }, [order.id]);
  const run = async (fn: () => Promise<any>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      load();
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };
  const riskScore = Math.min(
    100,
    (risk?.returned_count ?? 0) * 40 + (risk?.cancelled_count ?? 0) * 15,
  );
  return (
    <div className="mt-3 rounded-xl border bg-background p-3 space-y-2">
      {risk && riskScore >= 40 && (
        <div className="rounded-lg bg-destructive/10 p-2 text-xs font-medium text-destructive">
          ⚠ ঝুঁকি সতর্কতা: এই নম্বরে {risk.returned_count}টি রিটার্ন ও {risk.cancelled_count}টি
          বাতিল অর্ডার আছে (score {riskScore})। ডিসপ্যাচের আগে কাস্টমারকে ফোনে কনফার্ম করে নিন।
        </div>
      )}
      {risk?.blocked && (
        <div className="rounded-lg bg-destructive/10 p-2 text-xs font-semibold text-destructive">
          🚫 এই নম্বরটি ব্লক করা আছে — ডিসপ্যাচ করবেন না।
        </div>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="font-semibold mr-1">Send to courier:</span>
        {(["Steadfast", "Pathao"] as const).map((c) => (
          <button
            key={c}
            disabled={busy}
            onClick={() =>
              run(
                () => dispatchToCourier({ data: { orderId: order.id, courier: c } }),
                `Sent to ${c}`,
              )
            }
            className="rounded-full border px-3 py-1 hover:bg-muted"
          >
            {c}
          </button>
        ))}
        <span className="font-semibold ml-3 mr-1">SMS:</span>
        {(["confirmed", "shipped", "delivered"] as const).map((t) => (
          <button
            key={t}
            disabled={busy}
            onClick={() =>
              run(() => sendOrderSms({ data: { orderId: order.id, template: t } }), "SMS recorded")
            }
            className="rounded-full border px-3 py-1 hover:bg-muted"
          >
            {t}
          </button>
        ))}
      </div>
      {order.consignment_id && (
        <div>
          Consignment: <b>{order.consignment_id}</b> · {order.courier_status}
        </div>
      )}
      {log.dispatches.map((d) => (
        <div key={d.id} className="text-muted-foreground">
          🚚 {d.courier} · {d.mode} · {d.status} · COD {bdt(d.cod_amount_bdt)}
          {d.error ? ` · ${d.error}` : ""} · {new Date(d.created_at).toLocaleString()}
        </div>
      ))}
      {log.messages.map((m) => (
        <div key={m.id} className="text-muted-foreground">
          ✉ {m.channel} → {m.recipient} · {m.status}: {m.body}
        </div>
      ))}
    </div>
  );
}
