
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS admin_notes text;

CREATE UNIQUE INDEX IF NOT EXISTS refunds_one_open_per_payment_uidx
  ON public.refunds (payment_id)
  WHERE status IN ('requested','approved','processing','pending') AND deleted_at IS NULL;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS entry_type text CHECK (entry_type IN ('debit','credit')),
  ADD COLUMN IF NOT EXISTS account text,
  ADD COLUMN IF NOT EXISTS group_id uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS posted_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS event_type text;

CREATE UNIQUE INDEX IF NOT EXISTS txn_idempotency_uidx
  ON public.transactions (idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS txn_group_idx ON public.transactions (group_id);
CREATE INDEX IF NOT EXISTS txn_account_idx ON public.transactions (account, posted_at DESC);

CREATE OR REPLACE FUNCTION public.post_ledger_entry(
  _event_type text,
  _amount numeric,
  _currency text,
  _debit_account text,
  _credit_account text,
  _debit_user uuid DEFAULT NULL,
  _credit_user uuid DEFAULT NULL,
  _payment_id uuid DEFAULT NULL,
  _contract_id uuid DEFAULT NULL,
  _campaign_id uuid DEFAULT NULL,
  _description text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _idempotency_key text DEFAULT NULL,
  _created_by uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _group uuid := gen_random_uuid();
  _existing uuid;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'ledger amount must be positive';
  END IF;
  IF _idempotency_key IS NOT NULL THEN
    SELECT group_id INTO _existing FROM public.transactions
     WHERE idempotency_key = _idempotency_key || ':dr' LIMIT 1;
    IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  END IF;

  INSERT INTO public.transactions (
    user_id, counterparty_id, payment_id, contract_id, campaign_id,
    amount, currency, direction, status, description, metadata,
    entry_type, account, group_id, idempotency_key, event_type,
    created_by, posted_at
  ) VALUES
  (_debit_user, _credit_user, _payment_id, _contract_id, _campaign_id,
   _amount, _currency, 'outbound', 'succeeded', _description,
   COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('side','debit'),
   'debit', _debit_account, _group,
   CASE WHEN _idempotency_key IS NULL THEN NULL ELSE _idempotency_key || ':dr' END,
   _event_type, _created_by, now()),
  (_credit_user, _debit_user, _payment_id, _contract_id, _campaign_id,
   _amount, _currency, 'inbound', 'succeeded', _description,
   COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('side','credit'),
   'credit', _credit_account, _group,
   CASE WHEN _idempotency_key IS NULL THEN NULL ELSE _idempotency_key || ':cr' END,
   _event_type, _created_by, now());

  RETURN _group;
END;
$$;

REVOKE ALL ON FUNCTION public.post_ledger_entry(text,numeric,text,text,text,uuid,uuid,uuid,uuid,uuid,text,jsonb,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_ledger_entry(text,numeric,text,text,text,uuid,uuid,uuid,uuid,uuid,text,jsonb,text,uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_ledger_entry(text,numeric,text,text,text,uuid,uuid,uuid,uuid,uuid,text,jsonb,text,uuid) TO service_role;
