import { createFileRoute } from "@tanstack/react-router";
import { AppShell, Footer } from "@/components/AppShell";
import { Phone, Mail, MessageCircle, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — GochaoBD" }] }),
  component: () => (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-4xl">Contact us</h1>
        <p className="mt-2 text-muted-foreground">We reply within a few hours, 7 days a week.</p>
        <div className="mt-6 grid sm:grid-cols-2 gap-3">
          {[
            { Icon: Phone, label: "Call", value: "+880 1XXX-XXXXXX", href: "tel:+8801000000000" },
            { Icon: MessageCircle, label: "WhatsApp", value: "Chat with us", href: "https://wa.me/8801000000000" },
            { Icon: Mail, label: "Email", value: "hello@gochaobd.com", href: "mailto:hello@gochaobd.com" },
            { Icon: MapPin, label: "Location", value: "Dhaka, Bangladesh" },
          ].map(({ Icon, label, value, href }) => (
            <a key={label} href={href} className="rounded-2xl border p-4 bg-card flex items-center gap-3 hover:bg-muted">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand"><Icon className="h-5 w-5" /></div>
              <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-medium">{value}</div></div>
            </a>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); toast.success("Message sent! We'll be in touch."); (e.target as HTMLFormElement).reset(); }} className="mt-8 rounded-2xl border p-5 bg-card space-y-3">
          <h2 className="font-semibold">Send a message</h2>
          <input required placeholder="Your name" className="w-full rounded-xl border px-3 py-2.5 text-sm bg-background" />
          <input required type="email" placeholder="Email" className="w-full rounded-xl border px-3 py-2.5 text-sm bg-background" />
          <textarea required rows={4} placeholder="How can we help?" className="w-full rounded-xl border px-3 py-2.5 text-sm bg-background" />
          <button className="rounded-full bg-brand text-brand-foreground px-5 py-2.5 text-sm font-medium">Send</button>
        </form>
      </div>
      <Footer />
    </AppShell>
  ),
});
