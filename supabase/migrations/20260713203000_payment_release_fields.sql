-- Add columns for payout release tracking to public.payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payout_status text DEFAULT 'pending';
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS released_at timestamp with time zone;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES auth.users(id);

-- Create transactional release function
CREATE OR REPLACE FUNCTION public.admin_release_fund(
  _payment_id uuid,
  _admin_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay_row record;
  contract_row record;
  campaign_row record;
  release_amt numeric;
BEGIN
  -- 1. Authorization check: must be admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _admin_id AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Caller must be an authenticated administrator');
  END IF;

  -- 2. Get payment and lock row for update to prevent race conditions
  SELECT * INTO pay_row FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment transaction not found');
  END IF;

  -- 3. Validate payout status
  IF pay_row.payout_status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate release: Payout status is already completed');
  END IF;

  -- Validate payment has not already been released
  IF pay_row.status = 'released' OR pay_row.status_v2 = 'released' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate release: Payment has already been released');
  END IF;

  -- Validate cancelled payments
  IF pay_row.status = 'cancelled' OR pay_row.status_v2 = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Escrow violation: Cannot release cancelled payment');
  END IF;

  -- Validate refunded payments
  IF pay_row.status = 'refunded' OR pay_row.status_v2 = 'refunded' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Escrow violation: Cannot release refunded payment');
  END IF;

  -- Validate payment has been received (e.g. held / succeeded)
  IF pay_row.status_v2 IS DISTINCT FROM 'held' AND pay_row.status IS DISTINCT FROM 'held' AND pay_row.status IS DISTINCT FROM 'succeeded' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Escrow violation: Payment has not been received (status must be held)');
  END IF;

  -- 4. Get campaign
  SELECT * INTO campaign_row FROM public.campaigns WHERE id = pay_row.campaign_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Linked campaign not found');
  END IF;

  -- 5. Get contract and validate advertiser approved deliverables
  SELECT * INTO contract_row FROM public.contracts WHERE id = pay_row.contract_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Linked contract not found');
  END IF;

  IF contract_row.status IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Escrow violation: Cannot release fund before advertiser approves deliverables');
  END IF;

  -- 6. Release fund logic (Update payment)
  UPDATE public.payments
  SET status = 'released',
      payout_status = 'completed',
      released_at = now(),
      released_by = _admin_id,
      status_v2 = 'released'
  WHERE id = _payment_id;

  -- 7. Credit creator's wallet
  release_amt := COALESCE(pay_row.creator_earnings, pay_row.amount, 0);
  PERFORM public.apply_wallet_txn(
    pay_row.payee_id,
    'release'::public.wallet_txn_type,
    release_amt,
    'payment',
    _payment_id,
    'Funds released to available balance by admin'
  );

  -- 8. Complete contract and campaign
  UPDATE public.contracts SET status = 'completed' WHERE id = pay_row.contract_id;
  UPDATE public.campaigns SET status = 'completed' WHERE id = pay_row.campaign_id;

  -- 9. Notification to creator
  INSERT INTO public.notifications (
    user_id,
    title,
    body,
    type,
    payload
  ) VALUES (
    pay_row.payee_id,
    'Payment Released',
    'Your payment for ' || campaign_row.title || ' has been released successfully.',
    'payment_success'::public.notification_type,
    jsonb_build_object(
      'payment_id', _payment_id,
      'campaign_id', pay_row.campaign_id,
      'contract_id', pay_row.contract_id,
      'amount', release_amt
    )
  );

  -- 10. Audit Logging
  -- Payment events audit trail
  INSERT INTO public.payment_events (
    campaign_id,
    pitch_id,
    user_id,
    event_type,
    metadata
  ) VALUES (
    pay_row.campaign_id,
    pay_row.pitch_id,
    _admin_id,
    'payment_released',
    jsonb_build_object(
      'payment_id', _payment_id,
      'amount', release_amt,
      'released_by', _admin_id
    )
  );

  -- General activity audit trail
  INSERT INTO public.activity_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    _admin_id,
    'payment_released',
    'payment',
    _payment_id,
    jsonb_build_object(
      'amount', release_amt,
      'campaign_id', pay_row.campaign_id,
      'contract_id', pay_row.contract_id
    )
  );

  -- 11. If a payout_transactions table exists, insert a payout history record
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payout_transactions'
  ) THEN
    EXECUTE 'INSERT INTO public.payout_transactions (payment_id, amount, currency, status, created_at, processed_by) VALUES ($1, $2, $3, $4, now(), $5)'
    USING _payment_id, release_amt, pay_row.currency, 'completed', _admin_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'payment_id', _payment_id, 'amount', release_amt);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
