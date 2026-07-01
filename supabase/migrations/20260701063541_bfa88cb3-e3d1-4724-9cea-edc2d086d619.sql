
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta_role text;
  parsed_role public.app_role;
BEGIN
  meta_role := COALESCE(NEW.raw_user_meta_data->>'role', 'creator');
  BEGIN
    parsed_role := meta_role::public.app_role;
  EXCEPTION WHEN others THEN
    parsed_role := 'creator'::public.app_role;
  END;

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
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    active_role = COALESCE(EXCLUDED.active_role, public.profiles.active_role);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, parsed_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
