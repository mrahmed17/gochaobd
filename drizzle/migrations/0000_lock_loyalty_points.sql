DROP POLICY IF EXISTS "loyalty own update" ON public.loyalty;
REVOKE UPDATE, INSERT ON public.loyalty FROM authenticated;
GRANT INSERT (user_id) ON public.loyalty TO authenticated;