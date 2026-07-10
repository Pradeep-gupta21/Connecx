-- Migration to fix payout_methods check constraint, user_roles trigger crash on DELETE, and add profiles foreign key constraints

-- 1) Fix payout_methods bank constraint: check last4 and hash instead of full account_number
ALTER TABLE public.payout_methods DROP CONSTRAINT IF EXISTS payout_bank_fields_chk;

ALTER TABLE public.payout_methods ADD CONSTRAINT payout_bank_fields_chk CHECK (
  method_type <> 'bank' OR (
    account_holder_name IS NOT NULL AND
    bank_name IS NOT NULL AND
    account_number_last4 IS NOT NULL AND
    account_number_hash IS NOT NULL AND
    ifsc IS NOT NULL AND
    account_type IS NOT NULL
  )
);

-- 2) Fix guard_privileged_role_writes trigger to handle DELETE (where NEW is NULL)
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

  -- Never let a signed-in user mutate their own role rows from the client.
  IF actor IS NOT NULL AND target_user = actor AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'users cannot modify their own role assignments';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Add profiles foreign key constraint on payout_methods to allow PostgREST joins
ALTER TABLE public.payout_methods DROP CONSTRAINT IF EXISTS payout_methods_user_id_profiles_fkey;
ALTER TABLE public.payout_methods
  ADD CONSTRAINT payout_methods_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4) Add profiles foreign key constraint on withdrawals to allow PostgREST joins
ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_user_id_profiles_fkey;
ALTER TABLE public.withdrawals
  ADD CONSTRAINT withdrawals_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
