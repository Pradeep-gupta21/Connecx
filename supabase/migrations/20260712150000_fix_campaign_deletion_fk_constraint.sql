-- Fix Campaign Deletion Foreign Key Constraint Violation
-- This migration updates public.upsert_campaign_payment_summary to verify the campaign exists 
-- before upserting, preventing FK errors when campaign_id is set to NULL on campaigns deletion.

CREATE OR REPLACE FUNCTION public.upsert_campaign_payment_summary(_campaign_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _campaign_id IS NULL THEN RETURN; END IF;
  
  -- If the campaign does not exist in the campaigns table, delete its summary and return.
  -- This prevents foreign key constraint violations when referencing campaigns are deleted.
  IF NOT EXISTS (SELECT 1 FROM public.campaigns WHERE id = _campaign_id) THEN
    DELETE FROM public.campaign_payment_summary WHERE campaign_id = _campaign_id;
    RETURN;
  END IF;

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
