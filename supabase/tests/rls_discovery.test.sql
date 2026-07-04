-- RLS regression tests for Creator Discovery.
--
-- These are INTROSPECTION assertions — they verify that the policies, GRANTs,
-- and helper functions backing Creator Discovery still exist with the intended
-- shape. They run against any Postgres role that can read pg_catalog, so they
-- are safe to run in CI without needing to SET ROLE authenticated.
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_discovery.test.sql
--
-- Every failed assertion RAISES so the script exits non-zero.
--
-- A complementary behavioural test suite (impersonating authenticated /
-- anon roles via SET ROLE + request.jwt.claims) lives in the same folder
-- as rls_discovery.behaviour.sql and requires the postgres superuser.

DO $$
DECLARE
  n int;
BEGIN
  -- === 1. RLS is enabled on the two tables discovery reads =================
  SELECT count(*) INTO n
  FROM pg_class c
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relname IN ('profiles','creator_profiles')
    AND c.relrowsecurity;
  IF n <> 2 THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on profiles and creator_profiles (got %/2)', n;
  END IF;

  -- === 2. Authenticated users can SELECT both tables =======================
  PERFORM 1 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'creator_profiles'
     AND cmd = 'SELECT' AND 'authenticated' = ANY(roles);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: no SELECT policy on creator_profiles for authenticated';
  END IF;

  PERFORM 1 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'profiles'
     AND cmd = 'SELECT' AND 'authenticated' = ANY(roles);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: no SELECT policy on profiles for authenticated';
  END IF;

  -- === 3. Anonymous role has NO policies on these tables ===================
  SELECT count(*) INTO n FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('profiles','creator_profiles')
     AND 'anon' = ANY(roles);
  IF n > 0 THEN
    RAISE EXCEPTION 'FAIL: anon has % policy on discovery tables (should be 0)', n;
  END IF;

  -- === 4. Anonymous role has NO table-level SELECT grant ===================
  SELECT count(*) INTO n
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name IN ('profiles','creator_profiles')
    AND grantee = 'anon'
    AND privilege_type = 'SELECT';
  IF n > 0 THEN
    RAISE EXCEPTION 'FAIL: anon has direct SELECT grant on discovery tables (%)', n;
  END IF;

  -- === 5. Creators can only edit their own creator_profiles row ============
  -- Policy exists AND its USING clause scopes to auth.uid() = user_id.
  PERFORM 1 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'creator_profiles'
     AND 'authenticated' = ANY(roles)
     AND qual ILIKE '%auth.uid()%user_id%';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: creator_profiles missing auth.uid()=user_id self-scope policy';
  END IF;

  PERFORM 1 FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'profiles'
     AND cmd = 'UPDATE' AND 'authenticated' = ANY(roles)
     AND qual ILIKE '%auth.uid()%=%id%';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: profiles missing auth.uid()=id self-update policy';
  END IF;

  -- === 6. search_creators RPC exists and is granted to authenticated =======
  PERFORM 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'search_creators';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: public.search_creators is missing';
  END IF;

  SELECT count(*) INTO n
  FROM pg_proc p
  JOIN pg_namespace ns ON ns.oid = p.pronamespace
  WHERE ns.nspname = 'public'
    AND p.proname = 'search_creators'
    AND has_function_privilege('authenticated', p.oid, 'EXECUTE');
  IF n = 0 THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot EXECUTE search_creators';
  END IF;


  -- === 7. profiles.username is unique (case-insensitive) ===================
  PERFORM 1 FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename = 'profiles'
     AND indexname = 'profiles_username_lower_key';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: profiles missing unique lower(username) index';
  END IF;

  RAISE NOTICE 'OK: RLS discovery regression tests passed';
END $$;
