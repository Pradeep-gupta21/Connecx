
ALTER TYPE public.refund_status ADD VALUE IF NOT EXISTS 'requested';
ALTER TYPE public.refund_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE public.refund_status ADD VALUE IF NOT EXISTS 'rejected';
