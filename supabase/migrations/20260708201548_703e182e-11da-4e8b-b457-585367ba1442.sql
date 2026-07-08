
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'customer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- PROFILES
CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.phone);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories public read" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories admin write" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  specs TEXT,
  price_bdt INT NOT NULL,
  compare_price_bdt INT,
  flash_price_bdt INT,
  stock INT NOT NULL DEFAULT 0,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  images TEXT[] NOT NULL DEFAULT '{}',
  video_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_new BOOLEAN NOT NULL DEFAULT false,
  is_flash_sale BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC(2,1) NOT NULL DEFAULT 4.5,
  review_count INT NOT NULL DEFAULT 0,
  delivery_days TEXT DEFAULT '2-5 days',
  cod_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products public read" ON public.products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "products admin write" ON public.products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- WISHLIST
CREATE TABLE public.wishlists (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, product_id)
);
GRANT SELECT, INSERT, DELETE ON public.wishlists TO authenticated;
GRANT ALL ON public.wishlists TO service_role;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wishlist own" ON public.wishlists FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- COUPONS
CREATE TABLE public.coupons (
  code TEXT PRIMARY KEY,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed')),
  discount_value INT NOT NULL,
  min_order_bdt INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.coupons TO anon, authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons public read active" ON public.coupons FOR SELECT TO anon, authenticated USING (active = true);
CREATE POLICY "coupons admin write" ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ORDERS
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('GCH-' || upper(substr(md5(random()::text), 1, 8))),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_email TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  address_line TEXT NOT NULL,
  city TEXT NOT NULL,
  district TEXT,
  notes TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal_bdt INT NOT NULL,
  shipping_bdt INT NOT NULL DEFAULT 0,
  discount_bdt INT NOT NULL DEFAULT 0,
  total_bdt INT NOT NULL,
  coupon_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.orders TO authenticated;
GRANT SELECT, INSERT ON public.orders TO anon;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orders own read" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "orders own insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders guest insert" ON public.orders FOR INSERT TO anon WITH CHECK (user_id IS NULL);
CREATE POLICY "orders admin update" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
-- Track order by number+phone (public via server fn); no anon SELECT policy => use server publishable/admin.

-- ORDER ITEMS
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image TEXT,
  unit_price_bdt INT NOT NULL,
  qty INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_items TO authenticated, anon;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order_items read via order" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "order_items insert own" ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY "order_items insert guest" ON public.order_items FOR INSERT TO anon
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id IS NULL));

-- REVIEWS
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reviews public read" ON public.reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "reviews own insert" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- SEED categories + products + coupon
INSERT INTO public.categories (slug, name, image_url, sort_order) VALUES
  ('storage', 'Storage Solutions', '/src/assets/cat-storage.jpg', 1),
  ('kitchen', 'Kitchen Accessories', '/src/assets/cat-kitchen.jpg', 2),
  ('wardrobe', 'Home Organizers', '/src/assets/cat-wardrobe.jpg', 3),
  ('smart', 'Smart Home', '/src/assets/cat-smart.jpg', 4);

WITH c AS (SELECT slug, id FROM public.categories)
INSERT INTO public.products (slug, name, description, specs, price_bdt, compare_price_bdt, flash_price_bdt, stock, category_id, images, is_featured, is_new, is_flash_sale, rating, review_count) VALUES
  ('drawer-organizer', 'Multi-Compartment Drawer Organizer', 'Clear acrylic organizer keeps utensils and small items sorted. Fits standard kitchen drawers.', 'Material: Acrylic. Size: 30x22x5 cm. Compartments: 8.', 890, 1400, 690, 45, (SELECT id FROM c WHERE slug='kitchen'), ARRAY['/src/assets/product-1.jpg'], true, true, true, 4.7, 128),
  ('spice-jar-set-6', 'Airtight Spice Jar Set (6 pcs)', 'Bamboo lid glass jars with labels. Keeps spices fresh and pantry looking clean.', 'Material: Glass + Bamboo. Capacity: 120ml each. Includes: 6 jars, 24 labels.', 1290, 1900, NULL, 30, (SELECT id FROM c WHERE slug='kitchen'), ARRAY['/src/assets/product-2.jpg'], true, false, false, 4.8, 214),
  ('hanging-closet', '6-Shelf Hanging Closet Organizer', 'Fabric wardrobe organizer with 6 spacious shelves. Easy install on any rod.', 'Material: Non-woven fabric. Shelves: 6. Size: 30x30x120 cm.', 990, 1600, NULL, 60, (SELECT id FROM c WHERE slug='wardrobe'), ARRAY['/src/assets/product-3.jpg'], true, true, false, 4.6, 89),
  ('motion-sensor-light', 'Rechargeable Motion Sensor Light', 'Auto-on LED strip for closets, stairs and hallways. USB rechargeable.', 'Battery: 1200mAh USB-C. Sensor: PIR. Light: warm white.', 750, 1200, 590, 80, (SELECT id FROM c WHERE slug='smart'), ARRAY['/src/assets/product-4.jpg'], true, false, true, 4.5, 156),
  ('pantry-bins-4', 'Stackable Pantry Bins (Set of 4)', 'Deep bins with handles for organized pantry, fridge or shelves.', 'Material: BPA-free plastic. Set: 4 bins.', 1490, 2200, NULL, 25, (SELECT id FROM c WHERE slug='storage'), ARRAY['/src/assets/product-5.jpg'], true, true, false, 4.7, 72),
  ('under-sink-rack', 'Expandable Under-Sink Rack', 'Adjustable 2-tier rack maximises under-sink space around pipes.', 'Material: Coated metal. Expands 40-70 cm.', 1190, 1800, NULL, 40, (SELECT id FROM c WHERE slug='storage'), ARRAY['/src/assets/product-6.jpg'], false, false, false, 4.5, 61),
  ('silicone-utensils', 'Silicone Utensil Set with Wooden Handles', 'Heat-resistant silicone tools for non-stick cookware. Beautiful and durable.', 'Material: Food-grade silicone + beechwood. Set: 3 pcs.', 690, 990, NULL, 100, (SELECT id FROM c WHERE slug='kitchen'), ARRAY['/src/assets/product-7.jpg'], false, true, false, 4.6, 44),
  ('shoe-rack-10', '10-Tier Shoe Rack Organizer', 'Sturdy tall shoe rack for entryways and closets. Fits 30+ pairs.', 'Material: Fabric + metal frame. Tiers: 10.', 1890, 2900, NULL, 20, (SELECT id FROM c WHERE slug='wardrobe'), ARRAY['/src/assets/product-8.jpg'], false, false, false, 4.4, 38);

INSERT INTO public.coupons (code, discount_type, discount_value, min_order_bdt) VALUES
  ('GOCHAO10', 'percent', 10, 1000),
  ('NEW100', 'fixed', 100, 500);
