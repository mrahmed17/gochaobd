import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { bdt } from "@/lib/format";
import { getPaymentSession, confirmSandboxPayment } from "@/lib/orders.functions";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/pay/$number")({
  head: () => ({ meta: [{ title: "Complete payment — GochaoBD" }, { name: "robots", content: "noindex" }] }),
  component: PayPage,
});

const WALLETS: Record<string, { name: string; number: string; color: string }> = {
  bkash: { name: "bKash", number: "01700-000000", color: "#e2136e" },
  nagad: { name: "Nagad", number: "01800-000000", color: "#f6931e" },
};

function PayPage() {
  const { number } = Route.useParams();
  const nav = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [sender, setSender] = useState("");
  const [trx, setTrx] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPaymentSession({ data: { orderNumber: number } })
      .then(setOrder)
      .catch(() => toast.error("Order not found"));
  }, [number]);

  const wallet = WALLETS[order?.payment_method] ?? WALLETS['bkash']!;

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await confirmSandboxPayment({ data: { orderNumber: number, senderNumber: sender, trxId: trx } });
      toast.success("Payment confirmed");
      nav({ to: "/order-success/$number", params: { number } });
    } catch (err: any) {
      toast.error(err.message ?? "Could not confirm payment");
    } finally {
      setBusy(false);
    }
  }

  if (!order) return <AppShell><div className="p-8 text-sm text-muted-foreground">Loading payment…</div></AppShell>;

  if (order.payment_status === "paid") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-10 text-center">
          <h1 className="font-display text-2xl">Already paid</h1>
          <p className="mt-2 text-sm text-muted-foreground">Order {order.order_number} · reference {order.payment_ref}</p>
          <Link to="/track" className="mt-4 inline-block rounded-full bg-brand text-brand-foreground px-5 py-2.5 text-sm">Track order</Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-4 py-8">
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="p-5 text-white" style={{ background: wallet.color }}>
            <div className="text-xs opacity-90">Pay with</div>
            <div className="font-display text-2xl">{wallet.name}</div>
            <div className="mt-3 text-3xl font-semibold">{bdt(order.total_bdt)}</div>
            <div className="text-xs opacity-90">Order {order.order_number}</div>
          </div>

          <div className="p-5 space-y-4">
            <div className="rounded-xl bg-muted p-3 text-sm">
              <p className="font-medium">Test mode</p>
              <p className="text-xs text-muted-foreground">
                No real money moves yet. Send to <span className="font-mono">{wallet.number}</span> (Personal),
                then enter any transaction ID below to mark the order paid.
              </p>
            </div>

            <form onSubmit={confirm} className="space-y-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">Your {wallet.name} number *</span>
                <input required value={sender} onChange={(e) => setSender(e.target.value)} placeholder="01XXXXXXXXX"
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background" />
              </label>
              <label className="block">
                <span className="text-xs text-muted-foreground">Transaction ID *</span>
                <input required value={trx} onChange={(e) => setTrx(e.target.value)} placeholder="e.g. 9AB7CD2EF1"
                  className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm bg-background font-mono" />
              </label>
              <button disabled={busy} className="w-full rounded-full bg-brand text-brand-foreground py-3 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Confirm payment
              </button>
            </form>

            <Link to="/order-success/$number" params={{ number }} className="block text-center text-xs text-muted-foreground underline">
              I’ll pay later — show my order
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
