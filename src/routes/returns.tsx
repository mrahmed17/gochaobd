import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Footer } from "@/components/AppShell";

export const Route = createFileRoute("/returns")({
  head: () => ({
    meta: [
      { title: "Return & Refund Policy — GochaoBD" },
      { name: "description", content: "GochaoBD 7-day returns policy — how to return, refund timelines, damaged item handling and non-returnable items." },
      { property: "og:title", content: "Return & Refund Policy — GochaoBD" },
      { property: "og:description", content: "Easy 7-day returns and refunds across Bangladesh." },
      { property: "og:url", content: "https://gochaobd.lovable.app/returns" },
    ],
    links: [{ rel: "canonical", href: "https://gochaobd.lovable.app/returns" }],
  }),
  component: () => (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-4 text-sm text-muted-foreground">
        <h1 className="font-display text-4xl text-foreground">Return & Refund Policy</h1>
        <h2 className="text-foreground font-semibold text-lg mt-6">7-day returns</h2>
        <p>You may return most items within 7 days of delivery. Items must be unused, in original packaging with all accessories.</p>
        <h2 className="text-foreground font-semibold text-lg mt-6">How to return</h2>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Message us on WhatsApp with your order number and reason.</li>
          <li>We arrange pickup or you send via courier (fee reimbursed for defective items).</li>
          <li>Once inspected, refund is issued via original payment method or bKash within 3–5 working days.</li>
        </ol>
        <h2 className="text-foreground font-semibold text-lg mt-6">Damaged or wrong item</h2>
        <p>Contact us within 48 hours of delivery with photos — we'll replace or refund at no cost.</p>
        <h2 className="text-foreground font-semibold text-lg mt-6">Non-returnable</h2>
        <p>Hygiene items and clearance sale products are final sale.</p>
      </div>
      <Footer />
    </AppShell>
  ),
});
