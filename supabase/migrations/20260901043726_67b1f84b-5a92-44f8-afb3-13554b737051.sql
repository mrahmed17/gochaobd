
-- 1) Coupons: stop bulk public reads; expose single-code validation via a SECURITY DEFINER function
DROP POLICY IF EXISTS "coupons public read active" ON public.coupons;

CREATE OR REPLACE FUNCTION public.validate_coupon(p_code text)
RETURNS TABLE(code text, discount_type text, discount_value integer, min_order_bdt integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.code, c.discount_type, c.discount_value, c.min_order_bdt
  FROM public.coupons c
  WHERE c.code = upper(trim(p_code)) AND c.active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.validate_coupon(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text) TO anon, authenticated;

-- 2) Reviews: remove public read of user_id; expose a safe-column view instead
DROP POLICY IF EXISTS "reviews public read" ON public.reviews;

CREATE OR REPLACE VIEW public.reviews_public
WITH (security_barrier = true) AS
SELECT id, product_id, author_name, rating, comment, created_at
FROM public.reviews;

GRANT SELECT ON public.reviews_public TO anon, authenticated;

-- Review owners still need to see their own rows (e.g. after submitting)
CREATE POLICY "reviews own read"
ON public.reviews
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
