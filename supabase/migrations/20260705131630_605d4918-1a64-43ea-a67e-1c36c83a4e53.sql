
-- Enums
DO $$ BEGIN
  CREATE TYPE public.payout_method_type AS ENUM ('bank','upi');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payout_verification_status AS ENUM ('pending','verified','rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.bank_account_type AS ENUM ('savings','current');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE IF NOT EXISTS public.payout_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  method_type public.payout_method_type NOT NULL,
  label TEXT,

  -- Bank fields
  account_holder_name TEXT,
  bank_name TEXT,
  account_number_last4 TEXT,
  account_number_hash TEXT,        -- sha256 hex of full account number for duplicate detection
  account_number TEXT,             -- full number; RLS keeps it owner-only
  ifsc TEXT,
  account_type public.bank_account_type,

  -- UPI fields
  upi_id TEXT,

  is_default BOOLEAN NOT NULL DEFAULT false,
  verification_status public.payout_verification_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT payout_bank_fields_chk CHECK (
    method_type <> 'bank' OR (
      account_holder_name IS NOT NULL AND
      bank_name IS NOT NULL AND
      account_number IS NOT NULL AND
      ifsc IS NOT NULL AND
      account_type IS NOT NULL
    )
  ),
  CONSTRAINT payout_upi_fields_chk CHECK (
    method_type <> 'upi' OR (upi_id IS NOT NULL AND upi_id ~ '^[a-zA-Z0-9._-]+@[a-zA-Z]{2,}$')
  ),
  CONSTRAINT payout_ifsc_format_chk CHECK (
    ifsc IS NULL OR ifsc ~ '^[A-Z]{4}0[A-Z0-9]{6}$'
  )
);

-- Prevent duplicate accounts per user
CREATE UNIQUE INDEX IF NOT EXISTS payout_methods_user_bank_unique
  ON public.payout_methods(user_id, account_number_hash)
  WHERE method_type = 'bank' AND account_number_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payout_methods_user_upi_unique
  ON public.payout_methods(user_id, lower(upi_id))
  WHERE method_type = 'upi' AND upi_id IS NOT NULL;

-- Only one default per user
CREATE UNIQUE INDEX IF NOT EXISTS payout_methods_one_default_per_user
  ON public.payout_methods(user_id)
  WHERE is_default = true;

-- Auto-derive last4 + hash + normalize ifsc/upi
CREATE OR REPLACE FUNCTION public.payout_methods_normalize()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.method_type = 'bank' THEN
    NEW.account_number := regexp_replace(COALESCE(NEW.account_number,''), '\s+', '', 'g');
    NEW.ifsc := upper(regexp_replace(COALESCE(NEW.ifsc,''), '\s+', '', 'g'));
    NEW.account_number_last4 := right(NEW.account_number, 4);
    NEW.account_number_hash := encode(digest(NEW.account_number, 'sha256'), 'hex');
    NEW.upi_id := NULL;
  ELSIF NEW.method_type = 'upi' THEN
    NEW.upi_id := lower(trim(NEW.upi_id));
    NEW.account_number := NULL;
    NEW.account_number_hash := NULL;
    NEW.account_number_last4 := NULL;
    NEW.ifsc := NULL;
    NEW.account_type := NULL;
    NEW.bank_name := NULL;
  END IF;
  RETURN NEW;
END $$;

-- pgcrypto for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TRIGGER IF EXISTS trg_payout_methods_normalize ON public.payout_methods;
CREATE TRIGGER trg_payout_methods_normalize
BEFORE INSERT OR UPDATE ON public.payout_methods
FOR EACH ROW EXECUTE FUNCTION public.payout_methods_normalize();

-- Enforce single default: if setting is_default=true, unset others
CREATE OR REPLACE FUNCTION public.payout_methods_single_default()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.is_default THEN
    UPDATE public.payout_methods
       SET is_default = false, updated_at = now()
     WHERE user_id = NEW.user_id
       AND id <> NEW.id
       AND is_default = true;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_payout_methods_single_default ON public.payout_methods;
CREATE TRIGGER trg_payout_methods_single_default
AFTER INSERT OR UPDATE OF is_default ON public.payout_methods
FOR EACH ROW WHEN (NEW.is_default = true)
EXECUTE FUNCTION public.payout_methods_single_default();

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_payout_methods_updated_at ON public.payout_methods;
CREATE TRIGGER trg_payout_methods_updated_at
BEFORE UPDATE ON public.payout_methods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_methods TO authenticated;
GRANT ALL ON public.payout_methods TO service_role;

-- RLS
ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own payout methods"
  ON public.payout_methods FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users insert own payout methods"
  ON public.payout_methods FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own payout methods"
  ON public.payout_methods FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins update any payout method"
  ON public.payout_methods FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Users delete own payout methods"
  ON public.payout_methods FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
