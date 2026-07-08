import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { bdt } from "@/lib/format";
import { toast } from "sonner";
import { Package, ShoppingBag, Users, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — GochaoBD" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"dash" | "orders" | "products" | "coupons">("dash");
  const [stats, setStats] = useState<any>({});
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { nav({ to: "/auth", replace: true }); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      if (!roles?.some((r) => r.role === "admin")) {
        toast.error("Admin access only");
        nav({ to: "/account", replace: true });
        return;
      }
      setReady(true);
      reload();
    })();
  }, [nav]);

  async function reload() {
    const [{ data: o }, { data: p }, { data: c }] = await Promise.all([
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("coupons").select("*"),
    ]);
    setOrders(o ?? []); setProducts(p ?? []); setCoupons(c ?? []);
    setStats({
      revenue: (o ?? []).reduce((s, x) => s + x.total_bdt, 0),
      orders: o?.length ?? 0,
      products: p?.length ?? 0,
      pending: (o ?? []).filter((x) => x.status === "pending").length,
    });
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); reload(); }
  }

  async function updateStock(id: string, stock: number) {
    const { error } = await supabase.from("products").update({ stock }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Stock updated"); reload(); }
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
          {(["dash", "orders", "products", "coupons"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm capitalize border-b-2 ${tab === t ? "border-brand text-brand" : "border-transparent text-muted-foreground"}`}>
              {t === "dash" ? "Dashboard" : t}
            </button>
          ))}
        </div>

        {tab === "dash" && (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat icon={TrendingUp} label="Revenue" value={bdt(stats.revenue || 0)} />
            <Stat icon={ShoppingBag} label="Orders" value={stats.orders ?? 0} />
            <Stat icon={Package} label="Products" value={stats.products ?? 0} />
            <Stat icon={Users} label="Pending" value={stats.pending ?? 0} />
          </div>
        )}

        {tab === "orders" && (
          <div className="mt-6 rounded-2xl border overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr><th className="p-3">Order</th><th className="p-3">Customer</th><th className="p-3">Total</th><th className="p-3">Status</th></tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="p-3 font-mono text-xs">{o.order_number}<div className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</div></td>
                    <td className="p-3">{o.customer_name}<div className="text-xs text-muted-foreground">{o.customer_phone}</div></td>
                    <td className="p-3 font-semibold">{bdt(o.total_bdt)}</td>
                    <td className="p-3">
                      <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} className="rounded-full border px-2 py-1 text-xs bg-background">
                        {["pending", "confirmed", "shipped", "delivered", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!orders.length && <div className="p-8 text-center text-muted-foreground text-sm">No orders yet.</div>}
          </div>
        )}

        {tab === "products" && (
          <div className="mt-6 rounded-2xl border overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr><th className="p-3">Product</th><th className="p-3">Price</th><th className="p-3">Stock</th></tr>
              </thead>
              <tbody className="divide-y">
                {products.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3"><div className="font-medium">{p.name}</div><div className="text-xs text-muted-foreground">{p.slug}</div></td>
                    <td className="p-3">{bdt(p.price_bdt)}</td>
                    <td className="p-3">
                      <input type="number" defaultValue={p.stock} onBlur={(e) => updateStock(p.id, parseInt(e.target.value) || 0)} className="w-20 rounded-lg border px-2 py-1 text-sm bg-background" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "coupons" && (
          <div className="mt-6 rounded-2xl border bg-card p-4">
            <ul className="space-y-2">
              {coupons.map((c) => (
                <li key={c.code} className="flex items-center justify-between rounded-xl bg-muted p-3">
                  <div>
                    <div className="font-mono font-semibold">{c.code}</div>
                    <div className="text-xs text-muted-foreground">{c.discount_type === "percent" ? `${c.discount_value}% off` : `৳${c.discount_value} off`} · min order ৳{c.min_order_bdt}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? "bg-brand text-brand-foreground" : "bg-muted-foreground/20"}`}>{c.active ? "active" : "inactive"}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">Create additional coupons and manage detailed inventory from the Cloud dashboard.</p>
          </div>
        )}
      </div>
    </AppShell>
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
