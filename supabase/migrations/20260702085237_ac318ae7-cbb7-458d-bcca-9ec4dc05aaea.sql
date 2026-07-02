-- ============================================================
-- Payments: enums
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM (
    'pending','paid','held','revision_requested','released',
    'withdrawal_requested','withdrawn','refund_pending','refunded',
    'cancelled','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.wallet_txn_type AS ENUM (
    'credit','debit','hold','release','withdrawal','refund','fee','adjustment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.withdrawal_status AS ENUM (
    'requested','processing','completed','failed','cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.refund_status AS ENUM (
    'pending','processing','completed','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend existing payments table to align with Razorpay + new statuses
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS razorpay_signature text,
  ADD COLUMN IF NOT EXISTS notes jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS fee numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_reason text,
  ADD COLUMN IF NOT EXISTS status_v2 public.payment_status;

CREATE UNIQUE INDEX IF NOT EXISTS payments_rzp_order_uidx ON public.payments(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_rzp_payment_uidx ON public.payments(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_payer_idx ON public.payments(payer_id);
CREATE INDEX IF NOT EXISTS payments_payee_idx ON public.payments(payee_id);
CREATE INDEX IF NOT EXISTS payments_contract_idx ON public.payments(contract_id);
CREATE INDEX IF NOT EXISTS payments_status_v2_idx ON public.payments(status_v2);
CREATE INDEX IF NOT EXISTS payments_created_idx ON public.payments(created_at DESC);

-- ============================================================
-- wallets
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'INR',
  available_balance numeric(14,2) NOT NULL DEFAULT 0,
  held_balance numeric(14,2) NOT NULL DEFAULT 0,
  pending_balance numeric(14,2) NOT NULL DEFAULT 0,
  withdrawn_balance numeric(14,2) NOT NULL DEFAULT 0,
  lifetime_earned numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallets_nonneg CHECK (
    available_balance >= 0 AND held_balance >= 0 AND pending_balance >= 0 AND withdrawn_balance >= 0
  )
);
GRANT SELECT, INSERT, UPDATE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_owner_select" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "wallet_admin_all" ON public.wallets FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS wallets_user_idx ON public.wallets(user_id);
CREATE TRIGGER wallets_touch BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- wallet_transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.wallet_txn_type NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  balance_after numeric(14,2),
  reference_type text,
  reference_id uuid,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wtxn_owner_select" ON public.wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS wtxn_wallet_idx ON public.wallet_transactions(wallet_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wtxn_user_idx ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wtxn_ref_idx ON public.wallet_transactions(reference_type, reference_id);
CREATE TRIGGER wtxn_touch BEFORE UPDATE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- withdrawals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  status public.withdrawal_status NOT NULL DEFAULT 'requested',
  method text NOT NULL DEFAULT 'bank_transfer',
  destination jsonb NOT NULL DEFAULT '{}'::jsonb,
  razorpay_payout_id text UNIQUE,
  fee numeric(14,2) NOT NULL DEFAULT 0,
  failure_reason text,
  processed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wd_owner_select" ON public.withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "wd_owner_insert" ON public.withdrawals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wd_admin_update" ON public.withdrawals FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS wd_user_idx ON public.withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wd_status_idx ON public.withdrawals(status);
CREATE TRIGGER wd_touch BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- transactions (generic ledger)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  counterparty_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  status public.payment_status NOT NULL DEFAULT 'pending',
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "txn_party_select" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id OR auth.uid() = counterparty_id OR public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS txn_user_idx ON public.transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS txn_payment_idx ON public.transactions(payment_id);
CREATE INDEX IF NOT EXISTS txn_status_idx ON public.transactions(status);
CREATE TRIGGER txn_touch BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- refunds
-- ============================================================
CREATE TABLE IF NOT EXISTS public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  reason text,
  status public.refund_status NOT NULL DEFAULT 'pending',
  razorpay_refund_id text UNIQUE,
  processed_at timestamptz,
  failure_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "refund_party_select" ON public.refunds FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR EXISTS (
    SELECT 1 FROM public.payments p WHERE p.id = refunds.payment_id AND (p.payer_id = auth.uid() OR p.payee_id = auth.uid())
  )
);
CREATE POLICY "refund_admin_all" ON public.refunds FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS refunds_payment_idx ON public.refunds(payment_id);
CREATE INDEX IF NOT EXISTS refunds_status_idx ON public.refunds(status);
CREATE TRIGGER refunds_touch BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- payment_logs (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  from_status public.payment_status,
  to_status public.payment_status,
  message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.payment_logs TO authenticated;
GRANT ALL ON public.payment_logs TO service_role;
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plog_party_select" ON public.payment_logs FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR EXISTS (
    SELECT 1 FROM public.payments p WHERE p.id = payment_logs.payment_id AND (p.payer_id = auth.uid() OR p.payee_id = auth.uid())
  )
);
CREATE INDEX IF NOT EXISTS plog_payment_idx ON public.payment_logs(payment_id, created_at DESC);

-- ============================================================
-- payment_webhooks (idempotency store)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'razorpay',
  event_id text NOT NULL,
  event_type text NOT NULL,
  signature text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  error text,
  attempts int NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
GRANT ALL ON public.payment_webhooks TO service_role;
ALTER TABLE public.payment_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pwh_admin_select" ON public.payment_webhooks FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX IF NOT EXISTS pwh_event_type_idx ON public.payment_webhooks(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS pwh_processed_idx ON public.payment_webhooks(processed);

-- ============================================================
-- campaign_payment_summary (materialized rollup)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_payment_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL UNIQUE REFERENCES public.campaigns(id) ON DELETE CASCADE,
  total_paid numeric(14,2) NOT NULL DEFAULT 0,
  total_held numeric(14,2) NOT NULL DEFAULT 0,
  total_released numeric(14,2) NOT NULL DEFAULT 0,
  total_refunded numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  last_payment_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaign_payment_summary TO authenticated;
GRANT ALL ON public.campaign_payment_summary TO service_role;
ALTER TABLE public.campaign_payment_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cps_owner_select" ON public.campaign_payment_summary FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR EXISTS (
    SELECT 1 FROM public.campaigns c WHERE c.id = campaign_payment_summary.campaign_id AND c.advertiser_id = auth.uid()
  )
);
CREATE INDEX IF NOT EXISTS cps_campaign_idx ON public.campaign_payment_summary(campaign_id);
CREATE TRIGGER cps_touch BEFORE UPDATE ON public.campaign_payment_summary FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Wallet helper: ensure wallet exists
-- ============================================================
CREATE OR REPLACE FUNCTION public.ensure_wallet(_user_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE wid uuid;
BEGIN
  SELECT id INTO wid FROM public.wallets WHERE user_id = _user_id;
  IF wid IS NULL THEN
    INSERT INTO public.wallets(user_id) VALUES (_user_id) RETURNING id INTO wid;
  END IF;
  RETURN wid;
END; $$;

-- Atomic wallet mutation (server-only, called by service role)
CREATE OR REPLACE FUNCTION public.apply_wallet_txn(
  _user_id uuid,
  _type public.wallet_txn_type,
  _amount numeric,
  _reference_type text DEFAULT NULL,
  _reference_id uuid DEFAULT NULL,
  _description text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wid uuid; new_txn uuid; new_avail numeric; new_held numeric; new_pending numeric; new_withdrawn numeric;
BEGIN
  wid := public.ensure_wallet(_user_id);
  -- Lock the wallet row
  PERFORM 1 FROM public.wallets WHERE id = wid FOR UPDATE;

  IF _type = 'credit' THEN
    UPDATE public.wallets SET available_balance = available_balance + _amount, lifetime_earned = lifetime_earned + _amount WHERE id = wid;
  ELSIF _type = 'debit' THEN
    UPDATE public.wallets SET available_balance = available_balance - _amount WHERE id = wid;
  ELSIF _type = 'hold' THEN
    UPDATE public.wallets SET pending_balance = pending_balance + _amount, held_balance = held_balance + _amount WHERE id = wid;
  ELSIF _type = 'release' THEN
    UPDATE public.wallets SET held_balance = held_balance - _amount, pending_balance = GREATEST(pending_balance - _amount, 0), available_balance = available_balance + _amount, lifetime_earned = lifetime_earned + _amount WHERE id = wid;
  ELSIF _type = 'withdrawal' THEN
    UPDATE public.wallets SET available_balance = available_balance - _amount, withdrawn_balance = withdrawn_balance + _amount WHERE id = wid;
  ELSIF _type = 'refund' THEN
    UPDATE public.wallets SET available_balance = available_balance - _amount WHERE id = wid;
  ELSIF _type = 'fee' THEN
    UPDATE public.wallets SET available_balance = available_balance - _amount WHERE id = wid;
  ELSIF _type = 'adjustment' THEN
    UPDATE public.wallets SET available_balance = available_balance + _amount WHERE id = wid;
  END IF;

  SELECT available_balance INTO new_avail FROM public.wallets WHERE id = wid;

  INSERT INTO public.wallet_transactions(wallet_id, user_id, type, amount, balance_after, reference_type, reference_id, description, metadata)
  VALUES (wid, _user_id, _type, _amount, new_avail, _reference_type, _reference_id, _description, _metadata)
  RETURNING id INTO new_txn;
  RETURN new_txn;
END; $$;
