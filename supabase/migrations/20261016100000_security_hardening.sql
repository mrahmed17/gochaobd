-- ============================================================
-- Security hardening for a production launch
-- 1) Shared, cross-isolate rate limiting (login/OTP/payment/track/SMS abuse)
-- 2) Order idempotency — double-click / timeout-retry must not create a
--    second order or claim stock twice (double-spend guard)
-- 3) Payment TRX uniqueness — one bKash/Nagad transaction can only ever
--    be attached to a single order
-- 4) Indexes for the hot paths (orders timeline, items, reviews, catalog)
-- ============================================================

-- ------------------------------------------------------------
-- 1. RATE LIMITING
-- ------------------------------------------------------------
CREATE TABLE public.rate_limits (
  bucket text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  hits int NOT NULL DEFAULT 0
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.rate_limits TO service_role; -- server functions only
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits (window_start);

-- Atomically consume one attempt from the key's fixed window.
-- Returns TRUE while the caller is still allowed (hits <= limit), FALSE once
-- the limit is exceeded. SECURITY DEFINER + service_role-only EXECUTE, so it
-- works from every server isolate against one shared counter.
CREATE OR REPLACE FUNCTION public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  IF p_key IS NULL OR length(p_key) > 180 OR p_limit < 1 OR p_window_seconds < 1 THEN
    RETURN FALSE; -- malformed key: deny rather than bypass
  END IF;

  -- Opportunistic cleanup so the table stays tiny without a cron.
  IF random() < 0.02 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '2 days';
  END IF;

  INSERT INTO public.rate_limits AS rl (bucket, window_start, hits)
  VALUES (p_key, now(), 1)
  ON CONFLICT (bucket) DO UPDATE
    SET hits = CASE
                 WHEN rl.window_start < now() - make_interval(secs => p_window_seconds) THEN 1
                 ELSE rl.hits + 1
               END,
        window_start = CASE
                         WHEN rl.window_start < now() - make_interval(secs => p_window_seconds) THEN now()
                         ELSE rl.window_start
                       END
  RETURNING rl.hits INTO n;

  RETURN n <= p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.hit_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hit_rate_limit(text, integer, integer) TO service_role;

-- ------------------------------------------------------------
-- 2. ORDER IDEMPOTENCY (double-submit / timeout-retry guard)
-- ------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS checkout_session_key text;

-- The browser holds one random key per checkout attempt; a retry of the SAME
-- attempt collides here instead of inserting a second order. placeOrder()
-- catches 23505, gives the claimed stock back and returns the first order.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_checkout_session
  ON public.orders (checkout_session_key)
  WHERE checkout_session_key IS NOT NULL;

-- ------------------------------------------------------------
-- 3. PAYMENT TRX UNIQUENESS (double-spend guard)
-- ------------------------------------------------------------
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_trx text;

-- A submitted bKash/Nagad transaction ID can only ever mark ONE order as
-- paid; replaying it against a second order violates this index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_payment_trx
  ON public.orders (payment_trx)
  WHERE payment_trx IS NOT NULL;

-- ------------------------------------------------------------
-- 4. PERFORMANCE INDEXES (hot paths were unindexed beyond PKs)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON public.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON public.orders (customer_phone);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items (product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews (product_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_created ON public.products (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_created ON public.abandoned_carts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_alerts_product ON public.stock_alerts (product_id);

-- ------------------------------------------------------------
-- 5. CLOSE CLIENT-SIDE WRITE PATHS THAT WERE NEVER USED
-- ------------------------------------------------------------
-- Every order/item/notification write goes through service-role server
-- functions; these anon/authenticated policies only added abuse surface
-- (forged orders straight into the admin panel, forged notifications).
DROP POLICY IF EXISTS "orders own insert" ON public.orders;
DROP POLICY IF EXISTS "orders guest insert" ON public.orders;
DROP POLICY IF EXISTS "order_items insert own" ON public.order_items;
DROP POLICY IF EXISTS "order_items insert guest" ON public.order_items;
DROP POLICY IF EXISTS "notifications insert any" ON public.notifications;

-- Loyalty: the account page creates a row with 0 points and only the service
-- role ever awards balance — a client must not be able to write points.
DROP POLICY IF EXISTS "loyalty own insert" ON public.loyalty;
CREATE POLICY "loyalty own create" ON public.loyalty
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND points = 0);
DROP POLICY IF EXISTS "loyalty own update" ON public.loyalty;
