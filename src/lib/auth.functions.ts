import { createServerFn } from "@tanstack/react-start";
import { RATE, throttle } from "@/lib/rate-limit";
import { z } from "zod";

/**
 * Pre-flight budget for the browser auth flows.
 *
 * Supabase Auth applies its own limits at the provider, and sign-in/reset go
 * straight from the browser to Supabase — this guard adds an app-level budget
 * per IP (and per inbox for reset links) so one host cannot grind attempts,
 * and gives us a single auditable choke point if auth moves server-side.
 */
export const guardAuthAttempt = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        kind: z.enum(["signin", "signup", "reset", "oauth"]),
        identifier: z.string().trim().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await throttle(supabaseAdmin, `auth:${data.kind}`, RATE.authAttempt);
    if (data.kind === "reset" && data.identifier) {
      // Password-reset mails are the expensive one: cap per inbox too, so a
      // single address cannot be mail-bombed through this form.
      await throttle(
        supabaseAdmin,
        "auth:reset:inbox",
        RATE.passwordReset,
        data.identifier.toLowerCase(),
      );
    }
    return { ok: true as const };
  });
