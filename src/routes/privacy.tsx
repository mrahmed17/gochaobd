import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Footer } from "@/components/AppShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy Policy — GochaoBD" }] }),
  component: () => (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-10 space-y-4 text-sm text-muted-foreground">
        <h1 className="font-display text-4xl text-foreground">Privacy Policy</h1>
        <p>This page is maintained by GochaoBD to answer common privacy questions about our online store.</p>
        <h2 className="text-foreground font-semibold text-lg mt-6">What we collect</h2>
        <p>Name, phone number, delivery address, email and order history when you place an order or create an account.</p>
        <h2 className="text-foreground font-semibold text-lg mt-6">How we use it</h2>
        <p>Only to process, deliver and support your orders, and to send order-related updates. We don't sell your data.</p>
        <h2 className="text-foreground font-semibold text-lg mt-6">Cookies</h2>
        <p>We use essential cookies for cart, session and preferences. Analytics cookies are used only in aggregate to improve the store.</p>
        <h2 className="text-foreground font-semibold text-lg mt-6">Your choices</h2>
        <p>You can request deletion of your account data by contacting hello@gochaobd.com.</p>
        <p className="text-xs mt-8">This policy is provided as customer-facing information and is not a legal contract. For specific compliance requirements, please consult a legal professional.</p>
      </div>
      <Footer />
    </AppShell>
  ),
});
