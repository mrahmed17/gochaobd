import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AppShell, Footer } from "@/components/AppShell";
import { trackOrder } from "@/lib/orders.functions";
import { bdt } from "@/lib/format";
import { Package, Loader2, Truck } from "lucide-react";

const searchSchema = z.object({ number: z.string().optional() });

export const Route = createFileRoute("/track")({
  head: () => ({ meta: [{ title: "Track order — GochaoBD" }] }),
  validateSearch: searchSchema,
  component: TrackPage,
});

type Tracked = Awaited<ReturnType<typeof trackOrder>>;

function TrackPage() {
  const { number: initial } = Route.useSearch();
  const [number, setNumber] = useState(initial ?? "");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<Tracked | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      // Server-side lookup: verifies order number AND phone, returns a pruned
      // projection (never the internal id) and is rate-limited per IP.
      const data = await trackOrder({ data: { orderNumber: number, phone } });
      setOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order not found.");
    } finally {
      setLoading(false);
    }
  }

  const steps = ["pending", "confirmed", "shipped", "delivered"];
  const idx = order ? steps.indexOf(order.status) : -1;
  const abnormal = order && (order.status === "cancelled" || order.status === "returned");

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-6">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-brand" />
          <h1 className="text-2xl md:text-3xl font-display">Track your order</h1>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          অর্ডার নম্বর ও অর্ডারে ব্যবহৃত ফোন নম্বর দিন — দুটো মিললেই স্ট্যাটাস দেখাবে।
        </p>
        <form onSubmit={lookup} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="GCH-XXXXXXXX"
            className="flex-1 rounded-full border px-4 py-3 text-sm bg-background"
            required
          />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            placeholder="অর্ডারের ফোন নম্বর"
            className="flex-1 rounded-full border px-4 py-3 text-sm bg-background"
            required
          />
          <button
            disabled={loading}
            className="rounded-full bg-brand px-6 py-3 text-sm font-medium inline-flex items-center justify-center gap-2 text-brand-foreground disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Track
          </button>
        </form>
        {error && (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
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
                  const done = i <= idx;
                  return (
                    <li key={s} className="text-center">
                      <div
                        className={`mx-auto h-8 w-8 rounded-full grid place-items-center text-xs font-semibold ${done ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {i + 1}
                      </div>
                      <div
                        className={`mt-1 text-xs capitalize ${done ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {s}
                      </div>
                    </li>
                  );
                })}
              </ol>
              {abnormal && (
                <div className="mt-3 rounded-lg bg-destructive/10 p-2 text-xs font-medium text-destructive">
                  এই অর্ডার {order.status === "cancelled" ? "বাতিল" : "ফেরত"} করা হয়েছে। বিস্তারিত
                  জানতে সাপোর্টে যোগাযোগ করুন।
                </div>
              )}
            </div>
            {order.courier && (
              <div className="flex items-center gap-2 rounded-xl bg-muted p-2 text-sm">
                <Truck className="h-4 w-4 text-brand" />
                <span className="font-medium">{order.courier}</span>
                {order.tracking_number && (
                  <span className="font-mono text-xs text-muted-foreground">
                    #{order.tracking_number}
                  </span>
                )}
              </div>
            )}
            <div className="text-sm">
              <div className="font-semibold">Items</div>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {order.order_items.map((i, k) => (
                  <li key={`${i.product_name}-${k}`}>
                    {i.product_name}
                    {i.variant_label ? ` (${i.variant_label})` : ""} × {i.qty} —{" "}
                    {bdt(i.unit_price_bdt * i.qty)}
                  </li>
                ))}
              </ul>
              <div className="mt-2 font-semibold">Total: {bdt(order.total_bdt)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Payment: {order.payment_method.toUpperCase()} · {order.payment_status}
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </AppShell>
  );
}
