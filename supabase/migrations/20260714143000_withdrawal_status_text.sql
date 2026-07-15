-- Alter withdrawals.status to text to support review_pending status
ALTER TABLE public.withdrawals ALTER COLUMN status TYPE text USING status::text;

-- Update existing requested status to review_pending
UPDATE public.withdrawals SET status = 'review_pending' WHERE status = 'requested';
