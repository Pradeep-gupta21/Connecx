-- Migration to add failed_at and provider_response columns to public.withdrawals table

ALTER TABLE public.withdrawals 
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_response jsonb;
