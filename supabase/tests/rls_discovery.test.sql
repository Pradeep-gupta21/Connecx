-- RLS regression tests for Creator Discovery.
--
-- Verifies discovery read access and creator self-edit rules stay correct.
-- Run against a Supabase Postgres instance (admin role required):
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_discovery.test.sql
--
-- Uses two existing approved creator profiles and one non-creator profile as
-- test subjects, wraps everything in BEGIN/ROLLBACK so no data is mutated.
-- Assertions RAISE on failure so the script exits non-zero in CI.

BEGIN;

DO $$
DECLARE
  advertiser_id uuid;
  creator_a_id  uuid;
  creator_b_id  uuid;
  visible_count int;
  update_count  int;
  original_headline text;
BEGIN
  -- Pick two approved creators to test with.
  SELECT user_id INTO creator_a_id
  FROM public.creator_profiles
  WHERE deleted_at IS NULL AND approval_status = 'approved'
  ORDER BY created_at LIMIT 1;

  SELECT user_id INTO creator_b_id
  FROM public.creator_profiles
  WHERE deleted_at IS NULL AND approval_status = 'approved' AND user_id <> creator_a_id
  ORDER BY created_at LIMIT 1;

  -- Any profile that is not a creator makes a good "advertiser" impersonator.
  SELECT p.id INTO advertiser_id
  FROM public.profiles p
  LEFT JOIN public.creator_profiles cp ON cp.user_id = p.id
  WHERE cp.user_id IS NULL AND p.suspended_at IS NULL
  ORDER BY p.created_at LIMIT 1;

  IF creator_a_id IS NULL OR creator_b_id IS NULL OR advertiser_id IS NULL THEN
    RAISE NOTICE 'SKIP: need at least 2 approved creators + 1 non-creator profile to run tests';
    RETURN;
  END IF;

  RAISE NOTICE 'Testing with advertiser=%, creator_a=%, creator_b=%',
    advertiser_id, creator_a_id, creator_b_id;

  SELECT headline INTO original_headline
  FROM public.creator_profiles WHERE user_id = creator_a_id;

  -- === TEST 1: authenticated advertiser can read both creators ===
  SET LOCAL role = 'authenticated';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', advertiser_id, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO visible_count
  FROM public.creator_profiles cp
  WHERE cp.user_id IN (creator_a_id, creator_b_id);
  IF visible_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: advertiser should read both creator_profiles rows (got %)', visible_count;
  END IF;

  SELECT count(*) INTO visible_count
  FROM public.profiles WHERE id IN (creator_a_id, creator_b_id);
  IF visible_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: advertiser should read both profiles rows (got %)', visible_count;
  END IF;

  -- === TEST 2: advertiser CANNOT update another user's creator profile ===
  UPDATE public.creator_profiles SET headline = 'HACKED' WHERE user_id = creator_a_id;
  GET DIAGNOSTICS update_count = ROW_COUNT;
  IF update_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: advertiser was able to update another creator (rows=%)', update_count;
  END IF;

  -- === TEST 3: creator CAN update their own row, but NOT another's ===
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', creator_a_id, 'role', 'authenticated')::text, true);

  UPDATE public.creator_profiles SET headline = coalesce(headline,'') || ''
    WHERE user_id = creator_a_id;
  GET DIAGNOSTICS update_count = ROW_COUNT;
  IF update_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: creator A could not update own row (rows=%)', update_count;
  END IF;

  UPDATE public.creator_profiles SET headline = 'B hijacked' WHERE user_id = creator_b_id;
  GET DIAGNOSTICS update_count = ROW_COUNT;
  IF update_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: creator A wrote to creator B (rows=%)', update_count;
  END IF;

  -- === TEST 4: anon role has no direct read on profiles / creator_profiles ===
  RESET ROLE;
  SET LOCAL role = 'anon';
  PERFORM set_config('request.jwt.claims', NULL, true);

  BEGIN
    SELECT count(*) INTO visible_count FROM public.profiles;
    IF visible_count > 0 THEN
      RAISE EXCEPTION 'FAIL: anon should not read profiles (got %)', visible_count;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    SELECT count(*) INTO visible_count FROM public.creator_profiles;
    IF visible_count > 0 THEN
      RAISE EXCEPTION 'FAIL: anon should not read creator_profiles (got %)', visible_count;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  -- === TEST 5: search_creators RPC works for authenticated users ===
  RESET ROLE;
  SET LOCAL role = 'authenticated';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', advertiser_id, 'role', 'authenticated')::text, true);

  SELECT count(*) INTO visible_count FROM public.search_creators(_limit => 5);
  IF visible_count < 1 THEN
    RAISE EXCEPTION 'FAIL: search_creators returned nothing for authenticated caller';
  END IF;

  RESET ROLE;
  RAISE NOTICE 'OK: all RLS discovery regression tests passed';
END $$;

ROLLBACK;
