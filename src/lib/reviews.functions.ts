import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Signed-in customers upload a review photo (max ~4 MB) to the private media bucket. */
export const uploadReviewImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        contentType: z.string().regex(/^image\/(png|jpe?g|webp)$/),
        base64: z.string().max(5_600_000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const ext = data.contentType.split("/")[1].replace("jpeg", "jpg");
    const path = `reviews/${context.userId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { error } = await supabaseAdmin.storage
      .from("media")
      .upload(path, bytes, { contentType: data.contentType });
    if (error) throw new Error(error.message);
    const { data: signed, error: e2 } = await supabaseAdmin.storage
      .from("media")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (e2 || !signed) throw new Error(e2?.message ?? "Could not create link");
    return { url: signed.signedUrl };
  });
