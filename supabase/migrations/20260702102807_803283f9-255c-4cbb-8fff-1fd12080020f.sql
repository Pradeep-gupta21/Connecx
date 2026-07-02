
-- 1. Extend role enum with 'moderator'
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

-- 2. Bootstrap admin emails (configurable, not hardcoded in app)
CREATE TABLE IF NOT EXISTS public.admin_bootstrap_emails (
  email text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_bootstrap_emails TO service_role;
ALTER TABLE public.admin_bootstrap_emails ENABLE ROW LEVEL SECURITY;
-- No policies -> only service_role/definer functions can touch it.

INSERT INTO public.admin_bootstrap_emails (email, note)
VALUES ('ventroofficial215@gmail.com', 'Initial platform admin')
ON CONFLICT (email) DO NOTHING;

-- 3. Audit log view alias (existing activity_logs already has the columns)
CREATE OR REPLACE VIEW public.audit_logs AS
SELECT
  id,
  user_id       AS admin_id,
  action,
  entity_type   AS target_type,
  entity_id     AS target_id,
  metadata,
  ip_address,
  user_agent,
  created_at    AS "timestamp"
FROM public.activity_logs
WHERE deleted_at IS NULL;
GRANT SELECT ON public.audit_logs TO authenticated, service_role;

-- 4. Harden handle_new_user: auto-assign admin when email is bootstrapped
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta_role text;
  parsed_role public.app_role;
  is_bootstrap_admin boolean;
BEGIN
  meta_role := COALESCE(NEW.raw_user_meta_data->>'role', 'creator');
  BEGIN
    parsed_role := meta_role::public.app_role;
  EXCEPTION WHEN others THEN
    parsed_role := 'creator'::public.app_role;
  END;
  -- Never let clients self-assign admin/moderator via signup metadata
  IF parsed_role IN ('admin','moderator') THEN
    parsed_role := 'creator'::public.app_role;
  END IF;

  INSERT INTO public.profiles (id, display_name, avatar_url, country, phone, active_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'country',
    NEW.raw_user_meta_data->>'phone',
    parsed_role
  )
  ON CONFLICT (id) DO UPDATE SET
    country = COALESCE(EXCLUDED.country, public.profiles.country),
    phone   = COALESCE(EXCLUDED.phone,   public.profiles.phone),
    active_role = COALESCE(EXCLUDED.active_role, public.profiles.active_role);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, parsed_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_bootstrap_emails
    WHERE lower(email) = lower(NEW.email)
  ) INTO is_bootstrap_admin;

  IF is_bootstrap_admin THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    UPDATE public.profiles SET active_role = 'admin'::public.app_role WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Lock down user_roles: prevent client-side privilege escalation
-- Drop overly permissive policies.
DROP POLICY IF EXISTS "Users can add their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can remove their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins manage user_roles" ON public.user_roles;

-- Users may only self-assign non-privileged roles (creator/advertiser).
CREATE POLICY "Users self-assign non-privileged roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND role IN ('creator','advertiser'));

CREATE POLICY "Users remove own non-privileged roles"
ON public.user_roles FOR DELETE TO authenticated
USING (auth.uid() = user_id AND role IN ('creator','advertiser'));

-- Admins may manage non-privileged roles for other users only.
-- (Admins cannot grant admin/moderator and cannot modify their own roles.)
CREATE POLICY "Admins manage non-privileged roles for others"
ON public.user_roles FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  AND user_id <> auth.uid()
  AND role IN ('creator','advertiser')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  AND user_id <> auth.uid()
  AND role IN ('creator','advertiser')
);

-- Defense-in-depth trigger: block any privileged role writes that reach the
-- table via a non-definer path (RLS bypass, direct psql session, etc.).
CREATE OR REPLACE FUNCTION public.guard_privileged_role_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_role public.app_role;
  actor uuid;
BEGIN
  target_role := COALESCE(NEW.role, OLD.role);
  actor := auth.uid();

  IF target_role IN ('admin','moderator') THEN
    -- Only SECURITY DEFINER functions (running as postgres) or service_role may write.
    IF actor IS NOT NULL AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
      RAISE EXCEPTION 'privileged role assignment must go through a security-definer function';
    END IF;
  END IF;

  -- Never let a signed-in user mutate their own role rows from the client.
  IF actor IS NOT NULL AND NEW.user_id = actor AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'users cannot modify their own role assignments';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_privileged_role_writes ON public.user_roles;
CREATE TRIGGER trg_guard_privileged_role_writes
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_privileged_role_writes();

-- 6. Backfill: if the bootstrap admin already signed up, promote them now.
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN
    SELECT au.id, au.email
    FROM auth.users au
    JOIN public.admin_bootstrap_emails b ON lower(b.email) = lower(au.email)
  LOOP
    INSERT INTO public.profiles (id, display_name, active_role)
    VALUES (u.id, split_part(u.email,'@',1), 'admin')
    ON CONFLICT (id) DO UPDATE SET active_role = 'admin';

    INSERT INTO public.user_roles (user_id, role)
    VALUES (u.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (u.id, 'role.admin_granted', 'user', u.id, jsonb_build_object('reason','bootstrap'));
  END LOOP;
END $$;
