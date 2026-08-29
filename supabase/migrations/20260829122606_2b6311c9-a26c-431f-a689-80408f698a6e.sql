
-- 13. Address book
CREATE TABLE public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  full_name text NOT NULL,
  phone text NOT NULL,
  address_line text NOT NULL,
  city text NOT NULL,
  district text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addresses TO authenticated;
GRANT ALL ON public.addresses TO service_role;
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addresses own all" ON public.addresses FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 7. Product variants
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  option_group text NOT NULL DEFAULT 'Size',
  label text NOT NULL,
  price_delta_bdt integer NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variants public read" ON public.product_variants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "variants admin write" ON public.product_variants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 20. Back-in-stock alerts
CREATE TABLE public.stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  email text,
  phone text,
  notified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.stock_alerts TO anon;
GRANT SELECT, INSERT ON public.stock_alerts TO authenticated;
GRANT ALL ON public.stock_alerts TO service_role;
ALTER TABLE public.stock_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock alerts anyone insert" ON public.stock_alerts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "stock alerts admin read" ON public.stock_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 19. Loyalty and referrals
CREATE TABLE public.loyalty (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  referral_code text NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 6)),
  referred_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.loyalty TO authenticated;
GRANT ALL ON public.loyalty TO service_role;
ALTER TABLE public.loyalty ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty own read" ON public.loyalty FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "loyalty own insert" ON public.loyalty FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "loyalty own update" ON public.loyalty FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2. Notifications log
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email',
  recipient text NOT NULL,
  subject text,
  body text,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.notifications TO anon;
GRANT SELECT, INSERT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications insert any" ON public.notifications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "notifications admin read" ON public.notifications FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 16. Abandoned carts
CREATE TABLE public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  contact text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal_bdt integer NOT NULL DEFAULT 0,
  recovered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.abandoned_carts TO anon;
GRANT SELECT, INSERT, UPDATE ON public.abandoned_carts TO authenticated;
GRANT ALL ON public.abandoned_carts TO service_role;
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "carts insert any" ON public.abandoned_carts FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "carts own read" ON public.abandoned_carts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "carts own update" ON public.abandoned_carts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 6 / 7 column additions
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_zone text NOT NULL DEFAULT 'dhaka';
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS variant_label text;

-- 4. Automatic stock decrement
CREATE OR REPLACE FUNCTION public.decrement_stock_on_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products
      SET stock = GREATEST(0, stock - NEW.qty)
      WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_decrement_stock
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_order_item();

-- 5. Rating aggregation
CREATE OR REPLACE FUNCTION public.refresh_product_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pid uuid := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE public.products p
    SET rating = COALESCE((SELECT ROUND(AVG(r.rating)::numeric, 1) FROM public.reviews r WHERE r.product_id = pid), 0),
        review_count = (SELECT COUNT(*) FROM public.reviews r WHERE r.product_id = pid)
    WHERE p.id = pid;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_refresh_rating
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.refresh_product_rating();

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_addresses_updated BEFORE UPDATE ON public.addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_loyalty_updated BEFORE UPDATE ON public.loyalty
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_carts_updated BEFORE UPDATE ON public.abandoned_carts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed a few variants for demo
INSERT INTO public.product_variants (product_id, option_group, label, price_delta_bdt, stock, sort_order)
SELECT p.id, 'Size', v.label, v.delta, 25, v.ord
FROM public.products p
CROSS JOIN (VALUES ('Small', -100, 1), ('Medium', 0, 2), ('Large', 250, 3)) AS v(label, delta, ord)
WHERE p.slug IN (SELECT slug FROM public.products ORDER BY created_at LIMIT 4);
