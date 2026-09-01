
-- Replace security-definer view with column-level privileges on the base table
DROP VIEW IF EXISTS public.reviews_public;
DROP POLICY IF EXISTS "reviews own read" ON public.reviews;

REVOKE SELECT ON public.reviews FROM anon, authenticated;
GRANT SELECT (id, product_id, author_name, rating, comment, created_at) ON public.reviews TO anon, authenticated;
GRANT ALL ON public.reviews TO service_role;

-- Public can read reviews again, but only the safe columns granted above
CREATE POLICY "reviews public read"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (true);

-- Drop the publicly-executable definer function; coupon validation moves to a server function
REVOKE EXECUTE ON FUNCTION public.validate_coupon(text) FROM anon, authenticated;
DROP FUNCTION IF EXISTS public.validate_coupon(text);
