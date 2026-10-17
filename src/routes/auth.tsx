import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, Footer } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { guardAuthAttempt } from "@/lib/auth.functions";
import { toast } from "sonner";
import { Loader2, Mail, Chrome, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/auth")({
  // `next` is only honoured for same-site absolute paths — no protocol-relative
  // (//evil.com), no backslash tricks, no control characters.
  validateSearch: (s: Record<string, unknown>): { next?: string } => {
    const v = typeof s.next === "string" ? s.next : undefined;
    if (!v || !/^\/(?![/\\])/.test(v)) return {};
    for (let i = 0; i < v.length; i++) {
      if (v.charCodeAt(i) < 32) return {};
    }
    return { next: v };
  },
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
  const [show, setShow] = useState(false);

  async function forgot() {
    if (!email) {
      toast.error("আগে ইমেইল লিখুন");
      return;
    }
    try {
      await guardAuthAttempt({ data: { kind: "reset", identifier: email } });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) toast.error(error.message);
      else toast.success("পাসওয়ার্ড রিসেট লিংক ইমেইলে পাঠানো হয়েছে");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "আবার কিছুক্ষণ পরে চেষ্টা করুন");
    }
  }

  function goNext() {
    if (next) {
      try {
        const u = new URL(next, window.location.origin);
        if (u.origin === window.location.origin) {
          window.location.href = u.pathname + u.search + u.hash;
          return;
        }
      } catch {
        /* fall through */
      }
    }
    nav({ to: "/account", replace: true });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goNext();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) goNext();
    });
    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // App-level attempt budget before touching Supabase Auth.
      await guardAuthAttempt({
        data: { kind: mode === "signup" ? "signup" : "signin", identifier: email },
      });
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("অ্যাকাউন্ট তৈরি হয়েছে — কনফার্ম করতে ইমেইল চেক করুন");
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      goNext();
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err ?? "");
      toast.error(
        m.includes("Invalid login")
          ? "ইমেইল বা পাসওয়ার্ড ভুল। গুগল দিয়ে খোলা অ্যাকাউন্ট হলে 'Continue with Google' ব্যবহার করুন বা 'Forgot password' দিন।"
          : m.includes("Email not confirmed")
            ? "ইমেইল এখনও কনফার্ম হয়নি — ইনবক্স চেক করুন।"
            : m || "Auth failed",
      );
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    try {
      await guardAuthAttempt({ data: { kind: "oauth" } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "আবার কিছুক্ষণ পরে চেষ্টা করুন");
      return;
    }
    const res = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (res.error) {
      toast.error(res.error.message ?? "Google sign-in failed");
      return;
    }
    if (res.redirected) return;
    goNext();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="font-display text-3xl text-center">
          {mode === "signin" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground text-center">
          {mode === "signin"
            ? "Sign in to see your orders and wishlist."
            : "Track orders, save wishlist, faster checkout."}
        </p>

        <button
          onClick={google}
          className="mt-6 w-full rounded-full border py-3 text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-muted"
        >
          <Chrome className="h-4 w-4" /> Continue with Google
        </button>
        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or email
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full rounded-xl border px-3 py-3 text-sm bg-background"
            />
          )}
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="w-full rounded-xl border px-3 py-3 text-sm bg-background"
          />
          <div className="relative">
            <input
              required
              type={show ? "text" : "password"}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              className="w-full rounded-xl border px-3 py-3 pr-11 text-sm bg-background"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:bg-muted"
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {mode === "signin" && (
            <div className="text-right">
              <button type="button" onClick={forgot} className="text-xs text-brand">
                Forgot password?
              </button>
            </div>
          )}
          <button
            disabled={loading}
            className="w-full rounded-full bg-brand text-brand-foreground py-3 text-sm font-medium inline-flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New to GochaoBD? " : "Have an account? "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="text-brand font-medium"
          >
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link to="/">Continue as guest</Link> · checkout works without an account.
        </p>
      </div>
      <Footer />
    </AppShell>
  );
}
