
CREATE OR REPLACE FUNCTION public.search_creators(
  _q text DEFAULT NULL,
  _category text DEFAULT NULL,
  _skill text DEFAULT NULL,
  _location text DEFAULT NULL,
  _limit int DEFAULT 24,
  _offset int DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  headline text,
  categories text[],
  languages text[],
  rate_min int,
  rate_max int,
  follower_count int,
  display_name text,
  username text,
  avatar_url text,
  location text,
  bio text,
  updated_at timestamptz,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      cp.user_id,
      cp.headline,
      cp.categories,
      cp.languages,
      cp.rate_min,
      cp.rate_max,
      cp.follower_count,
      p.display_name,
      p.username,
      p.avatar_url,
      p.location,
      p.bio,
      cp.updated_at
    FROM public.creator_profiles cp
    JOIN public.profiles p ON p.id = cp.user_id
    WHERE cp.deleted_at IS NULL
      AND p.suspended_at IS NULL
      AND (_category IS NULL OR _category = 'all' OR cp.categories @> ARRAY[_category])
      AND (_skill IS NULL OR _skill = ''
           OR EXISTS (SELECT 1 FROM unnest(cp.categories) c WHERE c ILIKE '%' || _skill || '%'))
      AND (_location IS NULL OR _location = ''
           OR p.location ILIKE '%' || _location || '%')
      AND (_q IS NULL OR _q = ''
           OR p.display_name ILIKE '%' || _q || '%'
           OR p.username     ILIKE '%' || _q || '%'
           OR p.location     ILIKE '%' || _q || '%'
           OR p.bio          ILIKE '%' || _q || '%'
           OR cp.headline    ILIKE '%' || _q || '%'
           OR EXISTS (SELECT 1 FROM unnest(cp.categories) c WHERE c ILIKE '%' || _q || '%'))
  ), counted AS (
    SELECT b.*, count(*) OVER () AS total_count FROM base b
  )
  SELECT * FROM counted
  ORDER BY updated_at DESC NULLS LAST
  LIMIT GREATEST(_limit, 1)
  OFFSET GREATEST(_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.search_creators(text, text, text, text, int, int) TO authenticated;
