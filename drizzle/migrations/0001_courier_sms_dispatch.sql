CREATE TABLE public.courier_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  courier text NOT NULL,
  mode text NOT NULL DEFAULT 'sandbox',
  status text NOT NULL DEFAULT 'queued',
  consignment_id text,
  tracking_code text,
  cod_amount_bdt integer NOT NULL DEFAULT 0,
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_payload jsonb,
  error text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_courier_dispatches_order ON public.courier_dispatches(order_id);
GRANT SELECT ON public.courier_dispatches TO authenticated;
GRANT ALL ON public.courier_dispatches TO service_role;
ALTER TABLE public.courier_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read dispatches" ON public.courier_dispatches FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS consignment_id text, ADD COLUMN IF NOT EXISTS courier_status text, ADD COLUMN IF NOT EXISTS dispatched_at timestamptz;

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS provider text, ADD COLUMN IF NOT EXISTS provider_ref text, ADD COLUMN IF NOT EXISTS template text, ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS sent_at timestamptz, ADD COLUMN IF NOT EXISTS error text;