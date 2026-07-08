import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AppShell, Footer } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { bdt } from "@/lib/format";
import { Package, Loader2 } from "lucide-react";

const searchSchema = z.object({ number: z.string().optional() });

export const Route = createFileRoute("/track")({
  head: () => ({ meta: [{ title: "Track order — GochaoBD" }] }),
  validateSearch: searchSchema,
  component: TrackPage,
});

function TrackPage() {
  const { number: initial } = Route.useSearch();
  const [number, setNumber] = useState(initial ?? "");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null); setOrder(null);
    const { data, error } = await supabase.from("orders").select("*, order_items(*)").eq("order_number", number.trim()).maybeSingle();
    setLoading(false);
    if (error || !data) { setError("Order not found. Please check the order number."); return; }
    setOrder(data);
  }

  const steps = ["pending", "confirmed", "shipped", "delivered"];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center gap-2"><Package className="h-5 w-5 text-brand" /><h1 className="text-2xl md:text-3xl font-display">Track your order</h1></div>
        <form onSubmit={lookup} className="mt-4 flex gap-2">
          <input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="GCH-XXXXXXXX" className="flex-1 rounded-full border px-4 py-3 text-sm bg-background" required />
          <button disabled={loading} className="rounded-full bg-brand text-brand-foreground px-5 py-3 text-sm font-medium inline-flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Track
          </button>
        </form>
        {error && <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
        {order && (
          <div className="mt-6 rounded-2xl border bg-card p-4 space-y-4">
            <div>
              <div className="text-xs text-muted-foreground">Order number</div>
              <div className="font-mono font-semibold">{order.order_number}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-2">Status</div>
              <ol className="grid grid-cols-4 gap-2">
                {steps.map((s, i) => {
                  const idx = steps.indexOf(order.status);
                  const done = i <= idx;
                  return (
                    <li key={s} className="text-center">
                      <div className={`mx-auto h-8 w-8 rounded-full grid place-items-center text-xs font-semibold ${done ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
                      <div className={`mt-1 text-xs capitalize ${done ? "text-foreground" : "text-muted-foreground"}`}>{s}</div>
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="text-sm">
              <div className="font-semibold">Items</div>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {order.order_items.map((i: any) => <li key={i.id}>{i.product_name} × {i.qty} — {bdt(i.unit_price_bdt * i.qty)}</li>)}
              </ul>
              <div className="mt-2 font-semibold">Total: {bdt(order.total_bdt)}</div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </AppShell>
  );
}
