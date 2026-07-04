-- RLS regression tests for Creator Discovery.
--
-- Verifies that the policies backing discovery and creator self-edit stay
-- correct as the schema evolves. Run against a Supabase Postgres instance:
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_discovery.test.sql
--
-- Every assertion RAISES on failure so the script exits non-zero in CI.
-- Uses temporary auth.users rows and rolls back at the end, leaving no data.

BEGIN;

-- Impersonate the authenticated role and swap auth.uid() per test via
-- request.jwt.claims. This mirrors how PostgREST evaluates policies.

DO $$
DECLARE
  advertiser_id uuid := gen_random_uuid();
  creator_a_id  uuid := gen_random_uuid();
  creator_b_id  uuid := gen_random_uuid();
  visible_count int;
  update_count  int;
BEGIN
  -- Seed two creators and one advertiser as fake auth users.
  INSERT INTO auth.users (id, email) VALUES
    (advertiser_id, 'advertiser@test.local'),
    (creator_a_id,  'creator_a@test.local'),
    (creator_b_id,  'creator_b@test.local');

  INSERT INTO public.profiles (id, display_name, username)
  VALUES
    (advertiser_id, 'Test Advertiser', 'test_advertiser'),
    (creator_a_id,  'Creator A',       'creator_a_rls'),
    (creator_b_id,  'Creator B',       'creator_b_rls');

  INSERT INTO public.creator_profiles (user_id, headline, categories, approval_status)
  VALUES
    (creator_a_id, 'A headline', ARRAY['Fashion'], 'approved'),
    (creator_b_id, 'B headline', ARRAY['Tech'],    'approved');

  -- === TEST 1: authenticated advertiser can see both creators ===
  SET LOCAL role = 'authenticated';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', advertiser_id, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO visible_count
  FROM public.creator_profiles cp
  WHERE cp.user_id IN (creator_a_id, creator_b_id);

  IF visible_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: advertiser should read all approved creators (got %)', visible_count;
  END IF;

  SELECT count(*) INTO visible_count
  FROM public.profiles WHERE id IN (creator_a_id, creator_b_id);
  IF visible_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: advertiser should read creator profiles rows (got %)', visible_count;
  END IF;

  -- === TEST 2: advertiser CANNOT update another user's creator profile ===
  UPDATE public.creator_profiles SET headline = 'HACKED' WHERE user_id = creator_a_id;
  GET DIAGNOSTICS update_count = ROW_COUNT;
  IF update_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: advertiser was able to update another creator (%)', update_count;
  END IF;

  -- === TEST 3: creator CAN update their own row and only their own ===
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', creator_a_id, 'role', 'authenticated')::text, true);

  UPDATE public.creator_profiles SET headline = 'A updated' WHERE user_id = creator_a_id;
  GET DIAGNOSTICS update_count = ROW_COUNT;
  IF update_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: creator A could not update own row (%)', update_count;
  END IF;

  UPDATE public.creator_profiles SET headline = 'B hijacked' WHERE user_id = creator_b_id;
  GET DIAGNOSTICS update_count = ROW_COUNT;
  IF update_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: creator A wrote to creator B (%)', update_count;
  END IF;

  -- === TEST 4: anonymous role cannot read profiles ===
  RESET ROLE;
  SET LOCAL role = 'anon';
  PERFORM set_config('request.jwt.claims', NULL, true);

  BEGIN
    SELECT count(*) INTO visible_count FROM public.profiles;
    IF visible_count > 0 THEN
      RAISE EXCEPTION 'FAIL: anon should not read profiles (got %)', visible_count;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL; -- also acceptable
  END;

  BEGIN
    SELECT count(*) INTO visible_count FROM public.creator_profiles;
    IF visible_count > 0 THEN
      RAISE EXCEPTION 'FAIL: anon should not read creator_profiles (got %)', visible_count;
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  -- === TEST 5: search_creators RPC returns rows for authenticated users ===
  RESET ROLE;
  SET LOCAL role = 'authenticated';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', advertiser_id, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO visible_count
  FROM public.search_creators(_q => 'creator_a_rls');
  IF visible_count < 1 THEN
    RAISE EXCEPTION 'FAIL: search_creators cannot find creator A by @username';
  END IF;

  SELECT count(*) INTO visible_count
  FROM public.search_creators(_category => 'Tech');
  IF visible_count < 1 THEN
    RAISE EXCEPTION 'FAIL: search_creators category filter missed Tech creator';
  END IF;

  RESET ROLE;
  RAISE NOTICE 'OK: all RLS discovery regression tests passed';
END $$;

ROLLBACK;
