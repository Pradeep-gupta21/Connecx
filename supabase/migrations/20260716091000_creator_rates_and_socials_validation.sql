-- 1. Clean up null rates for existing creator profiles
UPDATE public.creator_profiles
SET 
  rate_min = COALESCE(rate_min, 100),
  rate_max = COALESCE(rate_max, 500)
WHERE rate_min IS NULL OR rate_max IS NULL;

-- 2. Add rate check constraint
ALTER TABLE public.creator_profiles ADD CONSTRAINT check_creator_rates CHECK (
  rate_min IS NOT NULL AND rate_min > 0 AND
  rate_max IS NOT NULL AND rate_max > 0 AND
  rate_max >= rate_min
);

-- 3. Seed placeholder social account for creators who have 0 linked accounts
INSERT INTO public.social_accounts (user_id, platform, handle, url, follower_count, engagement_rate, is_primary)
SELECT 
  cp.user_id, 
  'instagram'::public.social_platform, 
  'user_' || substring(cp.user_id::text from 1 for 8), 
  'https://instagram.com/user_' || substring(cp.user_id::text from 1 for 8), 
  1000, 
  0.0350, 
  true
FROM public.creator_profiles cp
LEFT JOIN public.social_accounts sa ON sa.user_id = cp.user_id AND sa.deleted_at IS NULL
WHERE sa.id IS NULL;

-- 4. Trigger to check creator profile has at least one social account on insert/update
CREATE OR REPLACE FUNCTION public.check_creator_profile_has_social()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  social_count int;
BEGIN
  SELECT count(*) INTO social_count
  FROM public.social_accounts
  WHERE user_id = NEW.user_id AND deleted_at IS NULL;

  IF social_count = 0 THEN
    RAISE EXCEPTION 'Cannot save creator profile without at least one linked social account.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_creator_profile_socials ON public.creator_profiles;
CREATE TRIGGER enforce_creator_profile_socials
BEFORE INSERT OR UPDATE OF rate_min, rate_max ON public.creator_profiles
FOR EACH ROW
EXECUTE FUNCTION public.check_creator_profile_has_social();

-- 5. Trigger to prevent deleting the last social account of a creator
CREATE OR REPLACE FUNCTION public.check_social_accounts_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  social_count int;
  is_creator boolean;
BEGIN
  -- Check if user is a creator
  SELECT EXISTS (
    SELECT 1 FROM public.creator_profiles WHERE user_id = OLD.user_id
  ) INTO is_creator;

  IF is_creator THEN
    -- Count remaining active social accounts
    SELECT count(*) INTO social_count
    FROM public.social_accounts
    WHERE user_id = OLD.user_id AND id != OLD.id AND deleted_at IS NULL;

    IF social_count = 0 THEN
      RAISE EXCEPTION 'A creator must have at least one linked social account.';
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS enforce_creator_socials_delete ON public.social_accounts;
CREATE TRIGGER enforce_creator_socials_delete
BEFORE DELETE ON public.social_accounts
FOR EACH ROW
EXECUTE FUNCTION public.check_social_accounts_limit();

DROP TRIGGER IF EXISTS enforce_creator_socials_deactivate ON public.social_accounts;
CREATE TRIGGER enforce_creator_socials_deactivate
BEFORE UPDATE OF deleted_at ON public.social_accounts
FOR EACH ROW
WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL)
EXECUTE FUNCTION public.check_social_accounts_limit();
