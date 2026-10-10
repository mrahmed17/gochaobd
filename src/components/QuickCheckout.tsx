import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { placeOrder } from "@/lib/orders.functions";
import { DELIVERY_ZONES, shippingFee } from "@/lib/queries";
import { bdt } from "@/lib/format";
import { track } from "@/lib/analytics";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";

type Item = { productId: string; name: string; price: number; image?: string; variant: string | null; qty: number };
const KEY = "gochao_quick_contact";

export function QuickCheckout({ open, onOpenChange, item }: { open: boolean; onOpenChange: (v: boolean) => void; item: Item }) {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", address: "", zone: "dhaka", payment: "cod" });

  useEffect(() => {
    if (!open) return;
    try { const s = localStorage.getItem(KEY); if (s) setF((p) => ({ ...p, ...JSON.parse(s) })); } catch {}
  }, [open]);

  const subtotal = item.price * item.qty;
  const shipping = shippingFee(f.zone, subtotal);
  const total = subtotal + shipping;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^01[3-9]\d{8}$/.test(f.phone.replace(/[\s-]/g, "").replace(/^\+?88/, ""))) { toast.error("সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)"); return; }
    setBusy(true);
    try {
      const city = f.zone === "outside" ? "Outside Dhaka" : "Dhaka";
      const r = await placeOrder({
        data: {
          customer: { name: f.name, phone: f.phone, email: "", address: f.address, city, district: "", notes: "Quick checkout", zone: f.zone as "dhaka", payment: f.payment as "cod" },
          items: [{ productId: item.productId, variant: item.variant, qty: item.qty }],
          couponCode: null,
        },
      });
      localStorage.setItem(KEY, JSON.stringify({ name: f.name, phone: f.phone, address: f.address, zone: f.zone }));
      track("purchase", { transaction_id: r.orderNumber, value: r.total, currency: "BDT", items: 1, quick: true });
      onOpenChange(false);
      if (r.requiresPayment) nav({ to: "/pay/$number", params: { number: r.orderNumber }, search: { k: r.paymentKey } });
      else nav({ to: "/order-success/$number", params: { number: r.orderNumber } });
    } catch (err: any) {
      toast.error(err.message ?? "অর্ডার করা যায়নি");
    } finally { setBusy(false); }
  }

  const input = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-accent-orange" /> এখনই কিনুন</DialogTitle>
          <DialogDescription>শুধু নাম, ফোন আর ঠিকানা দিন — অর্ডার কনফার্ম।</DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 items-center rounded-xl border p-2">
          {item.image && <img src={item.image} alt="" className="h-14 w-14 rounded-lg object-cover" />}
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-medium truncate">{item.name}</div>
            <div className="text-xs text-muted-foreground">{item.variant ? `${item.variant} · ` : ""}{item.qty} × {bdt(item.price)}</div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input required minLength={2} maxLength={120} placeholder="আপনার নাম" value={f.name} onChange={set("name")} className={input} />
          <input required inputMode="tel" placeholder="মোবাইল নম্বর (01XXXXXXXXX)" value={f.phone} onChange={set("phone")} className={input} />
          <textarea required minLength={4} maxLength={500} rows={2} placeholder="পূর্ণ ঠিকানা" value={f.address} onChange={set("address")} className={input} />
          <div className="grid grid-cols-3 gap-2">
            {DELIVERY_ZONES.map((z) => (
              <button type="button" key={z.value} onClick={() => setF({ ...f, zone: z.value })}
                className={`rounded-xl border px-2 py-2 text-xs ${f.zone === z.value ? "border-brand bg-brand-soft/40 font-medium" : ""}`}>
                {z.label}<div className="text-muted-foreground">৳{z.fee}</div>
              </button>
            ))}
          </div>
          <select value={f.payment} onChange={set("payment")} className={input}>
            <option value="cod">ক্যাশ অন ডেলিভারি</option>
            <option value="bkash">bKash</option>
            <option value="nagad">Nagad</option>
          </select>
          <div className="rounded-xl bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>সাবটোটাল</span><span>{bdt(subtotal)}</span></div>
            <div className="flex justify-between"><span>ডেলিভারি</span><span>{shipping ? bdt(shipping) : "ফ্রি"}</span></div>
            <div className="flex justify-between font-semibold pt-1 border-t"><span>মোট</span><span>{bdt(total)}</span></div>
          </div>
          <button disabled={busy} className="w-full rounded-full bg-accent-orange text-accent-orange-foreground py-3 text-sm font-semibold disabled:opacity-60 inline-flex items-center justify-center gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} অর্ডার কনফার্ম করুন · {bdt(total)}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
