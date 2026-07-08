import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Footer } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { bdt } from "@/lib/format";
import { LogOut, User, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "My account — GochaoBD" }, { name: "robots", content: "noindex" }] }),
  component: AccountPage,
});

function AccountPage() {
  const nav = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { nav({ to: "/auth", replace: true }); return; }
      setUser(data.user);
      const [{ data: prof }, { data: ords }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", data.user.id).maybeSingle(),
        supabase.from("orders").select("*").eq("user_id", data.user.id).order("created_at", { ascending: false }),
        supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      ]);
      setProfile(prof);
      setOrders(ords ?? []);
      setIsAdmin(!!roles?.some((r) => r.role === "admin"));
      setLoading(false);
    })();
  }, [nav]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id, full_name: profile?.full_name ?? "", phone: profile?.phone ?? "",
    });
    if (error) toast.error(error.message); else toast.success("Profile saved");
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/", replace: true });
  }

  if (loading) return <AppShell><div className="p-8 text-sm text-muted-foreground">Loading…</div></AppShell>;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 grid place-items-center rounded-full bg-brand-soft text-brand"><User className="h-5 w-5" /></div>
          <div>
            <h1 className="font-display text-2xl">{profile?.full_name || "Welcome"}</h1>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
          <button onClick={signOut} className="ml-auto rounded-full border px-4 py-2 text-sm inline-flex items-center gap-2"><LogOut className="h-4 w-4" />Sign out</button>
        </div>

        {isAdmin && (
          <Link to="/admin" className="block rounded-2xl bg-foreground text-background p-4 text-sm">
            <div className="font-semibold">Admin panel</div>
            <div className="opacity-80 text-xs">Manage products, orders and analytics.</div>
          </Link>
        )}

        <form onSubmit={saveProfile} className="rounded-2xl border p-4 bg-card space-y-3">
          <h2 className="font-semibold">Profile</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block"><span className="text-xs text-muted-foreground">Full name</span>
              <input value={profile?.full_name ?? ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background" />
            </label>
            <label className="block"><span className="text-xs text-muted-foreground">Phone</span>
              <input value={profile?.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background" />
            </label>
          </div>
          <button className="rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm font-medium">Save</button>
        </form>

        <div className="rounded-2xl border bg-card">
          <div className="p-4 border-b flex items-center gap-2"><Package className="h-4 w-4 text-brand" /><h2 className="font-semibold">My orders</h2></div>
          {orders.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No orders yet. <Link to="/shop" className="text-brand">Start shopping</Link></div>
          ) : (
            <ul className="divide-y">
              {orders.map((o) => (
                <li key={o.id} className="p-4 flex items-center gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-sm">{o.order_number}</div>
                    <div className="text-xs text-muted-foreground capitalize">{o.status} · {new Date(o.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="font-semibold text-sm">{bdt(o.total_bdt)}</div>
                    <Link to="/track" search={{ number: o.order_number }} className="text-xs text-brand">Track</Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Footer />
    </AppShell>
  );
}
