
-- 1) Hide phone from broad reads
REVOKE SELECT (phone) ON public.profiles FROM authenticated;
REVOKE SELECT (phone) ON public.profiles FROM anon;

CREATE OR REPLACE FUNCTION public.get_my_phone()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT phone FROM public.profiles WHERE id = auth.uid() $$;
REVOKE EXECUTE ON FUNCTION public.get_my_phone() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_phone() TO authenticated;

-- 2) Guard privileged column writes on creator_profiles / advertiser_profiles
CREATE OR REPLACE FUNCTION public.guard_approval_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason) THEN
    IF current_user NOT IN ('postgres','supabase_admin','service_role')
       AND NOT public.has_role(auth.uid(),'admin') THEN
      RAISE EXCEPTION 'approval fields can only be changed by an admin';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_approval_inserts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('postgres','supabase_admin','service_role')
     AND (auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin')) THEN
    NEW.approval_status := 'pending';
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
    NEW.rejection_reason := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_creator_approval ON public.creator_profiles;
CREATE TRIGGER guard_creator_approval BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_approval_writes();
DROP TRIGGER IF EXISTS guard_creator_approval_ins ON public.creator_profiles;
CREATE TRIGGER guard_creator_approval_ins BEFORE INSERT ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_approval_inserts();

DROP TRIGGER IF EXISTS guard_advertiser_approval ON public.advertiser_profiles;
CREATE TRIGGER guard_advertiser_approval BEFORE UPDATE ON public.advertiser_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_approval_writes();
DROP TRIGGER IF EXISTS guard_advertiser_approval_ins ON public.advertiser_profiles;
CREATE TRIGGER guard_advertiser_approval_ins BEFORE INSERT ON public.advertiser_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_approval_inserts();

-- 3) Narrow public read policies on creator/advertiser profiles
DROP POLICY IF EXISTS "Creator profiles readable by authenticated" ON public.creator_profiles;
CREATE POLICY "Creator profiles readable when approved or own"
ON public.creator_profiles
FOR SELECT TO authenticated
USING (
  (approval_status = 'approved' AND deleted_at IS NULL)
  OR auth.uid() = user_id
);

DROP POLICY IF EXISTS "Advertiser profiles readable by authenticated" ON public.advertiser_profiles;
CREATE POLICY "Advertiser profiles readable when approved or own"
ON public.advertiser_profiles
FOR SELECT TO authenticated
USING (
  (approval_status = 'approved' AND deleted_at IS NULL)
  OR auth.uid() = user_id
);

-- 4) Guard campaigns.funded* — only payment service (service role) can flip these
CREATE OR REPLACE FUNCTION public.guard_campaign_funding_writes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.funded IS DISTINCT FROM OLD.funded
     OR NEW.funded_amount IS DISTINCT FROM OLD.funded_amount
     OR NEW.funded_at IS DISTINCT FROM OLD.funded_at
     OR NEW.funded_payment_id IS DISTINCT FROM OLD.funded_payment_id) THEN
    IF current_user NOT IN ('postgres','supabase_admin','service_role') THEN
      RAISE EXCEPTION 'funding fields can only be changed by the payment service';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_campaign_funding_inserts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    NEW.funded := false;
    NEW.funded_amount := NULL;
    NEW.funded_at := NULL;
    NEW.funded_payment_id := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_campaign_funding ON public.campaigns;
CREATE TRIGGER guard_campaign_funding BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.guard_campaign_funding_writes();
DROP TRIGGER IF EXISTS guard_campaign_funding_ins ON public.campaigns;
CREATE TRIGGER guard_campaign_funding_ins BEFORE INSERT ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.guard_campaign_funding_inserts();

-- 5) Guard profiles admin-only fields (suspension)
CREATE OR REPLACE FUNCTION public.guard_profile_admin_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.suspended_reason IS DISTINCT FROM OLD.suspended_reason) THEN
    IF current_user NOT IN ('postgres','supabase_admin','service_role')
       AND NOT public.has_role(auth.uid(),'admin') THEN
      RAISE EXCEPTION 'suspension fields can only be changed by an admin';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_profile_admin_fields ON public.profiles;
CREATE TRIGGER guard_profile_admin_fields BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_admin_fields();

-- 6) Guard payout_methods verification fields
CREATE OR REPLACE FUNCTION public.guard_payout_method_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason) THEN
    IF current_user NOT IN ('postgres','supabase_admin','service_role')
       AND NOT public.has_role(auth.uid(),'admin') THEN
      RAISE EXCEPTION 'verification fields can only be changed by an admin';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_payout_method_verification_ins()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('postgres','supabase_admin','service_role')
     AND (auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin')) THEN
    NEW.verification_status := 'pending';
    NEW.verified_at := NULL;
    NEW.verified_by := NULL;
    NEW.rejection_reason := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_payout_method_verification ON public.payout_methods;
CREATE TRIGGER guard_payout_method_verification BEFORE UPDATE ON public.payout_methods
  FOR EACH ROW EXECUTE FUNCTION public.guard_payout_method_verification();
DROP TRIGGER IF EXISTS guard_payout_method_verification_ins ON public.payout_methods;
CREATE TRIGGER guard_payout_method_verification_ins BEFORE INSERT ON public.payout_methods
  FOR EACH ROW EXECUTE FUNCTION public.guard_payout_method_verification_ins();

-- 7) Stop persisting full bank account numbers
CREATE OR REPLACE FUNCTION public.payout_methods_normalize()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE _raw text;
BEGIN
  IF NEW.method_type = 'bank' THEN
    _raw := regexp_replace(COALESCE(NEW.account_number,''), '\s+', '', 'g');
    NEW.ifsc := upper(regexp_replace(COALESCE(NEW.ifsc,''), '\s+', '', 'g'));
    IF _raw <> '' THEN
      NEW.account_number_last4 := right(_raw, 4);
      NEW.account_number_hash := encode(digest(_raw, 'sha256'), 'hex');
    END IF;
    NEW.account_number := NULL;
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

UPDATE public.payout_methods SET account_number = NULL WHERE account_number IS NOT NULL;

-- 8) admin_bootstrap_emails: explicit admin-only SELECT policy (currently RLS on but no policy)
DROP POLICY IF EXISTS "Admins can read bootstrap emails" ON public.admin_bootstrap_emails;
CREATE POLICY "Admins can read bootstrap emails"
ON public.admin_bootstrap_emails
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin'));

-- 9) social_accounts: restrict broad read
DROP POLICY IF EXISTS "Anyone sees social accounts" ON public.social_accounts;
CREATE POLICY "Own or approved-creator socials visible"
ON public.social_accounts
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    auth.uid() = user_id
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.creator_profiles cp
      WHERE cp.user_id = social_accounts.user_id
        AND cp.approval_status = 'approved'
        AND cp.deleted_at IS NULL
    )
  )
);

-- 10) Fix mutable search_path on internal trigger fn
ALTER FUNCTION public.guard_privileged_role_writes() SET search_path = public;

-- 11) Revoke EXECUTE from anon/authenticated on internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.apply_wallet_txn(uuid, public.wallet_txn_type, numeric, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.post_ledger_entry(text, numeric, text, text, text, uuid, uuid, uuid, uuid, uuid, text, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_campaign_payment_summary(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, public.notification_type, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_wallet(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_wallet_txn(uuid, public.wallet_txn_type, numeric, text, uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_ledger_entry(text, numeric, text, text, text, uuid, uuid, uuid, uuid, uuid, text, jsonb, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_campaign_payment_summary(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.notify_user(uuid, public.notification_type, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(uuid) TO service_role;

-- Admin RPCs: revoke from anon (still callable by authenticated; check has_role internally)
REVOKE EXECUTE ON FUNCTION public.admin_set_approval(text, uuid, public.approval_status, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_suspension(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_review_payout_method(uuid, text, text) FROM PUBLIC, anon;
