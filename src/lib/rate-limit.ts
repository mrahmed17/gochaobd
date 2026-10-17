import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export interface RateSpec {
  limit: number;
  windowSeconds: number;
}

/** Budgets for every sensitive endpoint of the platform. */
export const RATE = {
  /** sign-in / sign-up attempts from one IP */
  authAttempt: { limit: 10, windowSeconds: 300 },
  /** password-reset mails per inbox */
  passwordReset: { limit: 3, windowSeconds: 900 },
  /** stock holds per IP (flash-sale DoS guard) */
  holdStock: { limit: 30, windowSeconds: 600 },
  /** payment TRX submissions per IP */
  paymentSubmit: { limit: 10, windowSeconds: 600 },
  /** payment TRX submissions against one order */
  paymentOrder: { limit: 5, windowSeconds: 600 },
  /** order-status lookups per IP (enumeration guard) */
  track: { limit: 30, windowSeconds: 300 },
  /** abandoned-cart nudge runs per IP */
  cartNudge: { limit: 4, windowSeconds: 600 },
  /** messages to one recipient (cost + spam guard) */
  smsPerRecipient: { limit: 6, windowSeconds: 3600 },
  /** AI assistant questions per admin per day */
  aiAsk: { limit: 50, windowSeconds: 86400 },
} as const;

export class RateLimitError extends Error {
  constructor() {
    super("অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
    this.name = "RateLimitError";
  }
}

/** Best-effort client IP from platform headers (null when unavailable). */
async function clientIp(): Promise<string | null> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const raw =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for") ??
      getRequestHeader("x-real-ip");
    const ip = (raw ?? "").split(",")[0]?.trim() ?? "";
    return ip && ip.length <= 64 ? ip : null;
  } catch {
    return null;
  }
}

/**
 * Consume one attempt from a shared, database-backed fixed window so the
 * budget holds across server isolates (an in-memory counter would not).
 *
 * - Throws {@link RateLimitError} once the budget is spent.
 * - Fails OPEN when the limiter itself is unavailable (migration not applied
 *   yet, transient DB error): availability wins, but the failure is logged
 *   loudly so it is never silent.
 *
 * `id` scopes the bucket to a stable caller-controlled value (order id,
 * recipient, user id). Never pass a value an attacker can rotate freely
 * unless the IP is also part of the bucket.
 */
export async function throttle(
  supabaseAdmin: SupabaseClient<Database>,
  key: string,
  spec: RateSpec,
  id?: string | null,
): Promise<void> {
  const ip = await clientIp();
  if (!ip && !id) return; // no stable identity — skip instead of one global bucket

  const parts = [key];
  if (id) parts.push(id.slice(0, 80));
  if (ip) parts.push(ip.slice(0, 40));
  const bucket = parts.join("|").slice(0, 180);

  try {
    const { data, error } = await supabaseAdmin.rpc("hit_rate_limit", {
      p_key: bucket,
      p_limit: spec.limit,
      p_window_seconds: spec.windowSeconds,
    });
    if (error) {
      console.warn(`[rate-limit] unavailable (${error.message}) bucket=${key}`);
      return;
    }
    if (data !== true) throw new RateLimitError();
  } catch (e) {
    if (e instanceof RateLimitError) throw e;
    console.warn(
      `[rate-limit] skipped (${e instanceof Error ? e.message : String(e)}) bucket=${key}`,
    );
  }
}
