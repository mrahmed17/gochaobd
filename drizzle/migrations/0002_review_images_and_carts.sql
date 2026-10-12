ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.reviews ADD CONSTRAINT reviews_images_max CHECK (cardinality(images) <= 4);

CREATE TABLE public.carts (
  user_id uuid PRIMARY KEY,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.carts TO authenticated;
GRANT ALL ON public.carts TO service_role;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own cart select" ON public.carts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own cart insert" ON public.carts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own cart update" ON public.carts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own cart delete" ON public.carts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_carts_sync_updated BEFORE UPDATE ON public.carts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();