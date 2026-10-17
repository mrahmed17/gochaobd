import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Footer } from "@/components/AppShell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — GochaoBD" },
      {
        name: "description",
        content:
          "GochaoBD is a Bangladeshi brand crafting affordable, beautiful home organizers, kitchen accessories and smart home essentials.",
      },
      { property: "og:title", content: "About GochaoBD" },
      {
        property: "og:description",
        content: "Meet the Bangladeshi brand helping women organize and beautify their homes.",
      },
      { property: "og:url", content: "https://gochaobd.lovable.app/about" },
    ],
    links: [{ rel: "canonical", href: "https://gochaobd.lovable.app/about" }],
  }),
  component: () => (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-10 prose prose-neutral">
        <h1 className="font-display text-4xl">About GochaoBD</h1>
        <p className="text-muted-foreground mt-3">
          GochaoBD is a Bangladesh-based online brand dedicated to helping women organize and
          beautify their homes with affordable, thoughtfully-selected products.
        </p>
        <p className="mt-3 text-muted-foreground">
          We source home organizers, kitchen accessories, storage solutions and smart home
          essentials — then handle everything ourselves so you get quality-checked products
          delivered with care.
        </p>
        <h2 className="font-display text-2xl mt-8">Our promise</h2>
        <ul className="mt-3 space-y-2 text-muted-foreground">
          <li>· Products we'd use in our own homes</li>
          <li>· Honest prices, no hidden fees</li>
          <li>· Cash on delivery across Bangladesh</li>
          <li>· 7-day returns if you change your mind</li>
        </ul>
      </div>
      <Footer />
    </AppShell>
  ),
});
