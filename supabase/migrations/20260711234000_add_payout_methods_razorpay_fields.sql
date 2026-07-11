-- Add razorpay_contact_id and razorpay_fund_account_id to public.payout_methods
ALTER TABLE public.payout_methods 
  ADD COLUMN IF NOT EXISTS razorpay_contact_id text,
  ADD COLUMN IF NOT EXISTS razorpay_fund_account_id text;

-- Add index for fast lookup
CREATE INDEX IF NOT EXISTS payout_methods_razorpay_contact_idx ON public.payout_methods(razorpay_contact_id);
CREATE INDEX IF NOT EXISTS payout_methods_razorpay_fund_account_idx ON public.payout_methods(razorpay_fund_account_id);
