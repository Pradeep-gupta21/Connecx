-- Redefine guard_privileged_role_writes to allow users to self-assign/remove non-privileged roles (creator/advertiser)
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

  -- Never let a signed-in user mutate their own PRIVILEGED role rows from the client.
  IF actor IS NOT NULL AND target_user = actor AND target_role IN ('admin','moderator') AND current_user NOT IN ('postgres','supabase_admin','service_role') THEN
    RAISE EXCEPTION 'users cannot modify their own privileged role assignments';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
