-- Add payment_id and campaign_id columns to public.withdrawals table if they don't exist
ALTER TABLE public.withdrawals 
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- Create indexes on these columns for faster lookup
CREATE INDEX IF NOT EXISTS withdrawals_payment_id_idx ON public.withdrawals(payment_id);
CREATE INDEX IF NOT EXISTS withdrawals_campaign_id_idx ON public.withdrawals(campaign_id);
