-- ============================================================
-- High-scale operational upgrade
-- 1) Inventory reservation (hold stock on checkout, atomic claim)
-- 2) Bundle deals (frequently-bought-together discounts)
-- 3) Phone-based courier fraud / return-rate tracking
-- 4) Abandoned-cart SMS recovery automation fields
-- ============================================================

-- ------------------------------------------------------------
-- 1. STOCK RESERVATION
-- ------------------------------------------------------------
CREATE TABLE public.stock_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_key text NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  qty int NOT NULL CHECK (qty > 0),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_stock_holds_product ON public.stock_holds(product_id) WHERE order_id IS NULL;
CREATE INDEX idx_stock_holds_session ON public.stock_holds(session_key) WHERE order_id IS NULL;
-- No public read/write: only SECURITY DEFINER functions touch this table.
ALTER TABLE public.stock_holds ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.stock_holds TO service_role;

-- Reserve (soft hold) for a checkout session. Idempotent per session:
-- previous un-consumed holds of the same session are replaced.
CREATE OR REPLACE FUNCTION public.reserve_stock(p_session text, p_items jsonb, p_minutes int DEFAULT 10)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it record;
  pname text;
  avail int;
BEGIN
  IF p_session IS NULL OR length(p_session) < 8 THEN
    RAISE EXCEPTION 'Bad session';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Bad items';
  END IF;

  DELETE FROM public.stock_holds
  WHERE session_key = p_session AND order_id IS NULL AND expires_at < now();

  FOR it IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, qty int)
  LOOP
    IF it.qty < 1 OR it.qty > 99 THEN RAISE EXCEPTION 'Bad qty'; END IF;

    SELECT p.name,
           p.stock - COALESCE((
             SELECT SUM(h.qty) FROM public.stock_holds h
             WHERE h.product_id = p.id AND h.order_id IS NULL
               AND h.expires_at > now() AND h.session_key <> p_session
           ), 0)
      INTO pname, avail
      FROM public.products p
     WHERE p.id = it.product_id
       FOR UPDATE;

    IF pname IS NULL THEN
      RAISE EXCEPTION 'A product in your cart is no longer available';
    END IF;
    IF avail < it.qty THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%:%', pname, GREATEST(avail, 0);
    END IF;

    INSERT INTO public.stock_holds (session_key, product_id, qty, expires_at)
    VALUES (p_session, it.product_id, it.qty, now() + make_interval(mins => GREATEST(1, LEAST(p_minutes, 60))));
  END LOOP;

  DELETE FROM public.stock_holds
  WHERE session_key = p_session AND order_id IS NULL
    AND created_at < now() - make_interval(mins => GREATEST(1, LEAST(p_minutes, 60)) + 1);
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_stock(text, jsonb, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_stock(text, jsonb, int) TO service_role;

-- Release a session's holds (customer left checkout).
CREATE OR REPLACE FUNCTION public.release_stock(p_session text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.stock_holds WHERE session_key = p_session AND order_id IS NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.release_stock(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_stock(text) TO service_role;

-- The old AFTER-INSERT decrement is replaced by the atomic claim below.
DROP TRIGGER IF EXISTS trg_decrement_stock ON public.order_items;
DROP FUNCTION IF EXISTS public.decrement_stock_on_order_item();

-- Atomic claim at order placement: locks each product row, verifies
-- available = stock - other sessions' active holds, then decrements.
CREATE OR REPLACE FUNCTION public.claim_stock(p_session text, p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it record;
  pname text;
  avail int;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Bad items';
  END IF;

  FOR it IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, qty int)
  LOOP
    IF it.qty < 1 OR it.qty > 99 THEN RAISE EXCEPTION 'Bad qty'; END IF;

    SELECT p.name,
           p.stock - COALESCE((
             SELECT SUM(h.qty) FROM public.stock_holds h
             WHERE h.product_id = p.id AND h.order_id IS NULL
               AND h.expires_at > now()
               AND (p_session IS NULL OR h.session_key <> p_session)
           ), 0)
      INTO pname, avail
      FROM public.products p
     WHERE p.id = it.product_id
       FOR UPDATE;

    IF pname IS NULL THEN
      RAISE EXCEPTION 'A product in your cart is no longer available';
    END IF;
    IF avail < it.qty THEN
      RAISE EXCEPTION 'OUT_OF_STOCK:%:%', pname, GREATEST(avail, 0);
    END IF;

    UPDATE public.products SET stock = stock - it.qty WHERE id = it.product_id;
  END LOOP;

  IF p_session IS NOT NULL THEN
    DELETE FROM public.stock_holds WHERE session_key = p_session;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_stock(text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stock(text, jsonb) TO service_role;

-- Compensation if the order rows cannot be written after a successful claim.
CREATE OR REPLACE FUNCTION public.restore_stock(p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE it record;
BEGIN
  IF p_items IS NULL THEN RETURN; END IF;
  FOR it IN
    SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id uuid, qty int)
  LOOP
    UPDATE public.products SET stock = stock + GREATEST(it.qty, 0) WHERE id = it.product_id;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.restore_stock(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_stock(jsonb) TO service_role;

-- ------------------------------------------------------------
-- 2. BUNDLE DEALS (frequently bought together)
-- ------------------------------------------------------------
CREATE TABLE public.product_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  with_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  discount_bdt int NOT NULL DEFAULT 0 CHECK (discount_bdt >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, with_product_id),
  CHECK (product_id <> with_product_id)
);
GRANT SELECT ON public.product_bundles TO anon, authenticated;
GRANT ALL ON public.product_bundles TO service_role;
ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bundles public read active" ON public.product_bundles
  FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "bundles admin write" ON public.product_bundles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ------------------------------------------------------------
-- 3. PHONE FRAUD / RETURN-RATE SCORE
-- ------------------------------------------------------------
CREATE TABLE public.phone_risk (
  phone text PRIMARY KEY CHECK (phone ~ '^01[3-9][0-9]{8}$'),
  returned_count int NOT NULL DEFAULT 0,
  cancelled_count int NOT NULL DEFAULT 0,
  order_count int NOT NULL DEFAULT 0,
  blocked boolean NOT NULL DEFAULT false,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.phone_risk TO authenticated;
GRANT ALL ON public.phone_risk TO service_role;
ALTER TABLE public.phone_risk ENABLE ROW LEVEL SECURITY;
CREATE POLICY "phone_risk admin read" ON public.phone_risk FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "phone_risk admin write" ON public.phone_risk FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS risk_score int NOT NULL DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS risk_note text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bundle_discount_bdt int NOT NULL DEFAULT 0;

-- ------------------------------------------------------------
-- 4. ABANDONED-CART SMS RECOVERY
-- ------------------------------------------------------------
ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS nudged_at timestamptz;
ALTER TABLE public.abandoned_carts ADD COLUMN IF NOT EXISTS discount_code text;
