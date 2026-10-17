import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Footer } from "@/components/AppShell";

const faqs = [
  { q: "How long does delivery take?", a: "2–3 days inside Dhaka, 3–5 days outside Dhaka." },
  { q: "Do you offer Cash on Delivery?", a: "Yes, COD is available across Bangladesh." },
  {
    q: "What is your return policy?",
    a: "You can return unopened items within 7 days of delivery. See our Return & Refund policy.",
  },
  {
    q: "Can I change or cancel my order?",
    a: "Contact us on WhatsApp within 2 hours of placing the order.",
  },
  { q: "Do you deliver outside Bangladesh?", a: "Currently we only deliver inside Bangladesh." },
  { q: "Which payment methods do you accept?", a: "Cash on Delivery, bKash and Nagad." },
];
export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — GochaoBD" },
      {
        name: "description",
        content:
          "Answers to common GochaoBD questions — delivery times, cash on delivery, returns, cancellations and payment methods in Bangladesh.",
      },
      { property: "og:title", content: "Frequently asked questions — GochaoBD" },
      {
        property: "og:description",
        content:
          "Delivery, returns, COD, bKash and Nagad — everything you need to know before ordering.",
      },
      { property: "og:url", content: "https://gochaobd.lovable.app/faq" },
    ],
    links: [{ rel: "canonical", href: "https://gochaobd.lovable.app/faq" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: () => (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-4xl">Frequently asked questions</h1>
        <div className="mt-6 rounded-2xl border bg-card divide-y">
          {faqs.map((f, i) => (
            <details key={i} className="p-4 group">
              <summary className="cursor-pointer font-medium flex items-center justify-between">
                {f.q}
                <span className="text-muted-foreground group-open:rotate-45 transition">+</span>
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
      <Footer />
    </AppShell>
  ),
});
