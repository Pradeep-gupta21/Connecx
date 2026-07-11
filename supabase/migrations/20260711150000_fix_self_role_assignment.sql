-- Redefine guard_privileged_role_writes to allow users to self-assign/remove non-privileged roles (creator/advertiser)
CREATE OR REPLACE FUNCTION public.guard_privileged_role_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  target_role public.app_role;
  actor uuid;
  target_user uuid;
BEGIN
  target_role := COALESCE(NEW.role, OLD.role);
  target_user := COALESCE(NEW.user_id, OLD.user_id);
  actor := auth.uid();

  IF target_role IN ('admin','moderator') THEN
    -- Only SECURITY DEFINER functions (running as postgres) or service_role may write.
    IF actor IS NOT NULL AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
      RAISE EXCEPTION 'privileged role assignment must go through a security-definer function';
    END IF;
  END IF;

  -- Never let a signed-in user mutate their own PRIVILEGED role rows from the client.
  IF actor IS NOT NULL AND target_user = actor AND target_role IN ('admin','moderator') AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'users cannot modify their own privileged role assignments';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Redefine apply_wallet_txn to be idempotent on referenced transaction types (prevents double-holds / double-spend on retries)
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
  -- Idempotency check: if transaction already exists, skip balance update and return existing txn id
  IF _reference_type IS NOT NULL AND _reference_id IS NOT NULL THEN
    SELECT id INTO new_txn FROM public.wallet_transactions
    WHERE user_id = _user_id AND reference_type = _reference_type AND reference_id = _reference_id AND type = _type
    LIMIT 1;
    
    IF new_txn IS NOT NULL THEN
      RETURN new_txn;
    END IF;
  END IF;

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
