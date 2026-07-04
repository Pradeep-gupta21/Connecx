GRANT EXECUTE ON FUNCTION public.search_creators(text, text, text, text, int, int) TO authenticated, anon;
-- anon grant is harmless: the function's WHERE clauses read only through the
-- caller's RLS context, and anon has no policy on the underlying tables.
