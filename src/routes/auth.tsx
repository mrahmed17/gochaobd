import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Footer } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Loader2, Mail, Chrome } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" && s.next.startsWith("/") && !s.next.startsWith("//") ? s.next : undefined,
  }),
  head: () => ({ meta: [{ title: "Sign in — GochaoBD" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  function goNext() {
    if (next) { window.location.href = next; return; }
    nav({ to: "/account", replace: true });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Account created — check your email if confirmation is required");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      nav({ to: "/account", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Auth failed");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) { toast.error(res.error.message ?? "Google sign-in failed"); return; }
    if (res.redirected) return;
    nav({ to: "/account", replace: true });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="font-display text-3xl text-center">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-muted-foreground text-center">{mode === "signin" ? "Sign in to see your orders and wishlist." : "Track orders, save wishlist, faster checkout."}</p>

        <button onClick={google} className="mt-6 w-full rounded-full border py-3 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-muted">
          <Chrome className="h-4 w-4" /> Continue with Google
        </button>
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or email<div className="h-px flex-1 bg-border" /></div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="w-full rounded-xl border px-3 py-3 text-sm bg-background" />
          )}
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="w-full rounded-xl border px-3 py-3 text-sm bg-background" />
          <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 6 chars)" className="w-full rounded-xl border px-3 py-3 text-sm bg-background" />
          <button disabled={loading} className="w-full rounded-full bg-brand text-brand-foreground py-3 text-sm font-medium inline-flex items-center justify-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New to GochaoBD? " : "Have an account? "}
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-brand font-medium">
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground"><Link to="/">Continue as guest</Link> · checkout works without an account.</p>
      </div>
      <Footer />
    </AppShell>
  );
}
