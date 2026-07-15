-- Migration to add 'needs_review' to the public.withdrawal_status enum type.
-- This status is used when automatic validations fail or fraud checks are triggered.

ALTER TYPE public.withdrawal_status ADD VALUE IF NOT EXISTS 'needs_review';
