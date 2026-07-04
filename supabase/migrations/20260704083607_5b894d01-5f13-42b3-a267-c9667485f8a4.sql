
-- 1. USERNAME COLUMN ---------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

-- Backfill from display_name or auth.email; ensure uniqueness
DO $$
DECLARE
  r record;
  base text;
  candidate text;
  n int;
BEGIN
  FOR r IN
    SELECT p.id, p.display_name, u.email
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.username IS NULL
  LOOP
    base := lower(regexp_replace(coalesce(nullif(r.display_name,''), split_part(coalesce(r.email,''),'@',1), 'user'), '[^a-zA-Z0-9_]+', '_', 'g'));
    base := regexp_replace(base, '^_+|_+$', '', 'g');
    IF length(base) < 3 THEN base := base || '_user'; END IF;
    IF length(base) > 24 THEN base := left(base, 24); END IF;
    candidate := base;
    n := 0;
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(candidate)) LOOP
      n := n + 1;
      candidate := left(base, 24) || '_' || n::text;
    END LOOP;
    UPDATE public.profiles SET username = candidate WHERE id = r.id;
  END LOOP;
END $$;

-- Unique case-insensitive index + format check via trigger (CHECK on lower() is fine but keep flexible)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username));

CREATE OR REPLACE FUNCTION public.validate_profile_username()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.username IS NULL THEN
    RETURN NEW;
  END IF;
  NEW.username := trim(NEW.username);
  IF NEW.username !~ '^[a-zA-Z0-9_]{3,30}$' THEN
    RAISE EXCEPTION 'username must be 3-30 characters (letters, numbers, underscores)';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_profile_username ON public.profiles;
CREATE TRIGGER validate_profile_username
  BEFORE INSERT OR UPDATE OF username ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_username();

-- 2. DISCOVERY INDEXES ------------------------------------------------------
CREATE INDEX IF NOT EXISTS creator_profiles_categories_gin
  ON public.creator_profiles USING gin (categories);

CREATE INDEX IF NOT EXISTS creator_profiles_updated_at_idx
  ON public.creator_profiles (updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS profiles_location_lower_idx
  ON public.profiles (lower(location));

CREATE INDEX IF NOT EXISTS profiles_display_name_lower_idx
  ON public.profiles (lower(display_name));
