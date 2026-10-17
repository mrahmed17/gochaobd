import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Reset password — GochaoBD" }, { name: "robots", content: "noindex" }],
  }),
  component: ResetPage,
});

function ResetPage() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("নতুন পাসওয়ার্ড সেট হয়েছে");
    nav({ to: "/account", replace: true });
  }
  return (
    <AppShell>
      <form onSubmit={submit} className="mx-auto max-w-md px-4 py-10 space-y-3">
        <h1 className="font-display text-3xl text-center">নতুন পাসওয়ার্ড দিন</h1>
        <div className="relative">
          <input
            required
            minLength={6}
            type={show ? "text" : "password"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="New password"
            className="w-full rounded-xl border px-3 py-3 pr-11 text-sm bg-background"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label="Toggle password"
            className="absolute right-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center text-muted-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <button
          disabled={busy}
          className="w-full rounded-full bg-brand text-brand-foreground py-3 text-sm font-medium"
        >
          Save password
        </button>
      </form>
    </AppShell>
  );
}
