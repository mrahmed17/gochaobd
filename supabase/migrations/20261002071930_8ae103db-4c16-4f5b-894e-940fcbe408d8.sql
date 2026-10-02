DROP POLICY IF EXISTS "notifications insert any" ON public.notifications;

DROP POLICY IF EXISTS "stock alerts anyone insert" ON public.stock_alerts;
CREATE POLICY "stock alerts validated insert" ON public.stock_alerts
FOR INSERT TO anon, authenticated
WITH CHECK (
  notified = false
  AND (
    (email IS NOT NULL AND length(email) BETWEEN 3 AND 200 AND email LIKE '%@%')
    OR (phone IS NOT NULL AND length(phone) BETWEEN 6 AND 20)
  )
);

DROP POLICY IF EXISTS "carts insert any" ON public.abandoned_carts;
CREATE POLICY "carts validated insert" ON public.abandoned_carts
FOR INSERT TO anon, authenticated
WITH CHECK (
  recovered = false
  AND (user_id IS NULL OR user_id = auth.uid())
  AND (contact IS NULL OR length(contact) <= 200)
  AND jsonb_typeof(items) = 'array'
  AND jsonb_array_length(items) BETWEEN 1 AND 50
  AND subtotal_bdt >= 0
);