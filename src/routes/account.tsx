import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Footer } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { bdt } from "@/lib/format";
import { useCart } from "@/lib/cart";
import { LogOut, User, Package, MapPin, Gift, Heart, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account — GochaoBD" },
      { name: "description", content: "Manage your GochaoBD profile, saved addresses, loyalty points and order history." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccountPage,
});

const emptyAddress = {
  label: "Home", full_name: "", phone: "", address_line: "", city: "Dhaka", district: "", is_default: false,
};

function AccountPage() {
  const nav = useNavigate();
  const { wishlist } = useCart();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loyalty, setLoyalty] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addrForm, setAddrForm] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { nav({ to: "/auth", replace: true }); return; }
      setUser(data.user);
      await loadAll(data.user.id);
      setLoading(false);
    })();
  }, [nav]);

  async function loadAll(uid: string) {
    const [{ data: prof }, { data: ords }, { data: roles }, { data: addr }, { data: loy }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("orders").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("addresses").select("*").eq("user_id", uid).order("is_default", { ascending: false }),
      supabase.from("loyalty").select("*").eq("user_id", uid).maybeSingle(),
    ]);
    setProfile(prof);
    setOrders(ords ?? []);
    setIsAdmin(!!roles?.some((r) => r.role === "admin"));
    setAddresses(addr ?? []);
    if (loy) setLoyalty(loy);
    else {
      const { data: created } = await supabase.from("loyalty").insert({ user_id: uid }).select("*").maybeSingle();
      setLoyalty(created);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("profiles").upsert({
      user_id: user.id, full_name: profile?.full_name ?? "", phone: profile?.phone ?? "",
    });
    if (error) toast.error(error.message); else toast.success("Profile saved");
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    const payload = { ...addrForm, user_id: user.id };
    const { error } = addrForm.id
      ? await supabase.from("addresses").update(payload).eq("id", addrForm.id)
      : await supabase.from("addresses").insert(payload);
    if (error) { toast.error(error.message); return; }
    if (payload.is_default) {
      await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id).neq("id", addrForm.id ?? "00000000-0000-0000-0000-000000000000");
    }
    toast.success("Address saved");
    setAddrForm(null);
    loadAll(user.id);
  }

  async function removeAddress(id: string) {
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Address removed"); loadAll(user.id); }
  }

  async function signOut() {
    await supabase.auth.signOut();
    nav({ to: "/", replace: true });
  }

  if (loading) return <AppShell><div className="p-8 text-sm text-muted-foreground">Loading…</div></AppShell>;

  const referralLink = loyalty?.referral_code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${loyalty.referral_code}`
    : "";

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

        {/* Loyalty & referral */}
        <div className="rounded-2xl border bg-card p-4">
          <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-accent-orange" /><h2 className="font-semibold">Rewards</h2></div>
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-brand-soft/40 p-3">
              <div className="text-xs text-muted-foreground">Loyalty points</div>
              <div className="font-display text-2xl">{loyalty?.points ?? 0}</div>
              <div className="text-xs text-muted-foreground">100 points = ৳100 off your next order</div>
            </div>
            <div className="rounded-xl bg-muted p-3">
              <div className="text-xs text-muted-foreground">Your referral code</div>
              <div className="font-mono text-lg">{loyalty?.referral_code ?? "—"}</div>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(referralLink); toast.success("Referral link copied"); }}
                className="mt-1 inline-flex items-center gap-1 text-xs text-brand"
              ><Copy className="h-3 w-3" /> Copy invite link</button>
            </div>
          </div>
        </div>

        {/* Wishlist shortcut */}
        <Link to="/wishlist" className="flex items-center gap-3 rounded-2xl border bg-card p-4">
          <Heart className="h-4 w-4 text-accent-orange fill-accent-orange" />
          <div className="text-sm font-semibold">My wishlist</div>
          <span className="ml-auto text-sm text-muted-foreground">{wishlist.length} item{wishlist.length === 1 ? "" : "s"} →</span>
        </Link>

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

        {/* Address book */}
        <div className="rounded-2xl border bg-card">
          <div className="p-4 border-b flex items-center gap-2">
            <MapPin className="h-4 w-4 text-brand" /><h2 className="font-semibold">Address book</h2>
            <button onClick={() => setAddrForm({ ...emptyAddress })} className="ml-auto rounded-full border px-3 py-1.5 text-xs">Add address</button>
          </div>
          {addresses.length === 0 && !addrForm ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No saved addresses yet.</div>
          ) : (
            <ul className="divide-y">
              {addresses.map((a) => (
                <li key={a.id} className="p-4 flex gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">{a.label} {a.is_default && <span className="ml-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] text-brand">Default</span>}</div>
                    <div className="text-muted-foreground">{a.full_name} · {a.phone}</div>
                    <div className="text-muted-foreground">{a.address_line}, {a.city}{a.district ? `, ${a.district}` : ""}</div>
                  </div>
                  <div className="ml-auto flex items-start gap-2">
                    <button onClick={() => setAddrForm(a)} className="text-xs text-brand">Edit</button>
                    <button onClick={() => removeAddress(a.id)} aria-label="Delete address" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {addrForm && (
            <form onSubmit={saveAddress} className="p-4 border-t space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <AField label="Label" value={addrForm.label} onChange={(v) => setAddrForm({ ...addrForm, label: v })} />
                <AField label="Full name" value={addrForm.full_name} onChange={(v) => setAddrForm({ ...addrForm, full_name: v })} required />
                <AField label="Phone" value={addrForm.phone} onChange={(v) => setAddrForm({ ...addrForm, phone: v })} required />
                <AField label="City" value={addrForm.city} onChange={(v) => setAddrForm({ ...addrForm, city: v })} required />
                <AField label="Address" value={addrForm.address_line} onChange={(v) => setAddrForm({ ...addrForm, address_line: v })} required className="sm:col-span-2" />
                <AField label="Area / District" value={addrForm.district ?? ""} onChange={(v) => setAddrForm({ ...addrForm, district: v })} />
                <label className="flex items-center gap-2 text-sm mt-5">
                  <input type="checkbox" checked={!!addrForm.is_default} onChange={(e) => setAddrForm({ ...addrForm, is_default: e.target.checked })} className="accent-[--color-brand]" />
                  Set as default
                </label>
              </div>
              <div className="flex gap-2">
                <button className="rounded-full bg-brand text-brand-foreground px-5 py-2 text-sm font-medium">Save address</button>
                <button type="button" onClick={() => setAddrForm(null)} className="rounded-full border px-5 py-2 text-sm">Cancel</button>
              </div>
            </form>
          )}
        </div>

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

function AField({ label, value, onChange, required, className }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-xs text-muted-foreground">{label}{required && " *"}</span>
      <input required={required} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background" />
    </label>
  );
}
