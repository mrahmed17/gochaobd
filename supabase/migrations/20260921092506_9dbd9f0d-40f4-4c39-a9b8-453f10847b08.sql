CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  description text,
  theme_color text NOT NULL DEFAULT '#1f7a4d',
  accent_color text NOT NULL DEFAULT '#f97316',
  logo_url text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stores TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores TO authenticated;
GRANT ALL ON public.stores TO service_role;

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stores public read" ON public.stores
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "stores admin write" ON public.stores
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_stores_updated BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.categories ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.products   ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.coupons    ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;
ALTER TABLE public.orders     ADD COLUMN store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL;

CREATE INDEX idx_categories_store ON public.categories(store_id);
CREATE INDEX idx_products_store ON public.products(store_id);
CREATE INDEX idx_orders_store ON public.orders(store_id);

ALTER TABLE public.orders ADD COLUMN payment_ref text;
ALTER TABLE public.orders ADD COLUMN payment_provider text;