import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, Footer } from "@/components/AppShell";
import { CheckCircle2, Package, MessageCircle } from "lucide-react";

export const Route = createFileRoute("/order-success/$number")({
  head: () => ({
    meta: [{ title: "Order confirmed — GochaoBD" }, { name: "robots", content: "noindex" }],
  }),
  component: OrderSuccess,
});

function OrderSuccess() {
  const { number } = Route.useParams();
  return (
    <AppShell>
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <div className="mx-auto h-16 w-16 grid place-items-center rounded-full bg-brand-soft text-brand">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-4 font-display text-3xl">Order confirmed!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thanks for shopping with GochaoBD. We'll be in touch on WhatsApp to confirm delivery.
        </p>
        <div className="mt-6 rounded-2xl border bg-card p-4 text-left">
          <div className="text-xs text-muted-foreground">Order number</div>
          <div className="font-mono text-lg">{number}</div>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            to="/track"
            search={{ number }}
            className="rounded-full bg-brand text-brand-foreground py-3 text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            <Package className="h-4 w-4" /> Track this order
          </Link>
          <a
            href="https://wa.me/8801000000000"
            target="_blank"
            rel="noreferrer"
            className="rounded-full border py-3 text-sm inline-flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-4 w-4" /> Chat on WhatsApp
          </a>
          <Link to="/shop" className="text-sm text-brand mt-2">
            Continue shopping
          </Link>
        </div>
      </div>
      <Footer />
    </AppShell>
  );
}
