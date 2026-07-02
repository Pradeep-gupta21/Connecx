
-- Campaigns: funding metadata
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS funded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS funded_amount numeric,
  ADD COLUMN IF NOT EXISTS funded_at timestamptz,
  ADD COLUMN IF NOT EXISTS funded_payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_fee_pct numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS gst_pct numeric NOT NULL DEFAULT 18;

-- Payments: fee breakdown + campaign link + invoicing
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gst numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_earnings numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_amount numeric,
  ADD COLUMN IF NOT EXISTS receipt_number text,
  ADD COLUMN IF NOT EXISTS invoice_number text;

CREATE INDEX IF NOT EXISTS idx_payments_campaign ON public.payments(campaign_id);

-- Contracts: deliverables + review cycle
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS deliverable_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submission_notes text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision_notes text,
  ADD COLUMN IF NOT EXISTS revision_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL;

-- Withdrawals: admin approval + payout tracking
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_notes text,
  ADD COLUMN IF NOT EXISTS payout_id text,
  ADD COLUMN IF NOT EXISTS payout_ref text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Sequences for receipt/invoice numbering
CREATE SEQUENCE IF NOT EXISTS public.receipt_seq START 100001;
CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 100001;

CREATE OR REPLACE FUNCTION public.next_receipt_number()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT 'RCPT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text,6,'0');
$$;
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT 'INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text,6,'0');
$$;

-- Notify helper for workflow events
CREATE OR REPLACE FUNCTION public.notify_user(
  _user_id uuid,
  _type public.notification_type,
  _title text,
  _body text DEFAULT NULL,
  _payload jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (user_id, type, title, body, payload)
  VALUES (_user_id, _type, _title, _body, COALESCE(_payload,'{}'::jsonb));
END; $$;

REVOKE ALL ON FUNCTION public.notify_user(uuid, public.notification_type, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, public.notification_type, text, text, jsonb) TO service_role;

-- Payment summary upsert helper
CREATE OR REPLACE FUNCTION public.upsert_campaign_payment_summary(_campaign_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _campaign_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.campaign_payment_summary(campaign_id, total_paid, total_held, total_released, total_refunded, currency, last_payment_at)
  SELECT
    _campaign_id,
    COALESCE(SUM(CASE WHEN status_v2 IN ('held','released','withdrawn','withdrawal_requested','refund_pending','refunded') THEN amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status_v2 = 'held' THEN amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status_v2 IN ('released','withdrawn','withdrawal_requested') THEN amount ELSE 0 END),0),
    COALESCE(SUM(CASE WHEN status_v2 = 'refunded' THEN amount ELSE 0 END),0),
    COALESCE(MAX(currency),'INR'),
    MAX(processed_at)
  FROM public.payments WHERE campaign_id = _campaign_id AND deleted_at IS NULL
  ON CONFLICT (campaign_id) DO UPDATE SET
    total_paid = EXCLUDED.total_paid,
    total_held = EXCLUDED.total_held,
    total_released = EXCLUDED.total_released,
    total_refunded = EXCLUDED.total_refunded,
    last_payment_at = EXCLUDED.last_payment_at,
    updated_at = now();
END; $$;

REVOKE ALL ON FUNCTION public.upsert_campaign_payment_summary(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_campaign_payment_summary(uuid) TO service_role;

-- Unique index for the upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_payment_summary_campaign ON public.campaign_payment_summary(campaign_id);

-- Trigger to keep summary fresh
CREATE OR REPLACE FUNCTION public.trg_payments_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.upsert_campaign_payment_summary(COALESCE(NEW.campaign_id, OLD.campaign_id));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS payments_summary_sync ON public.payments;
CREATE TRIGGER payments_summary_sync
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_payments_after_change();

-- Realtime publications for workflow tables
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.contracts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ensure trigger touches updated_at on new tables consistently
DROP TRIGGER IF EXISTS trg_contracts_updated ON public.contracts;
CREATE TRIGGER trg_contracts_updated BEFORE UPDATE ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
