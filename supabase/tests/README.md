# Database regression tests

## RLS: Creator Discovery

`rls_discovery.test.sql` verifies that the policies, grants, and helper
functions backing Creator Discovery stay correct as the schema evolves.

It uses `pg_catalog` introspection so it can run against any Postgres role
that can read metadata — no need to `SET ROLE authenticated`.

### Run

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_discovery.test.sql
```

A failed assertion raises and the script exits non-zero — wire it into CI
after every deploy or migration.

### What it asserts

1. RLS is enabled on `profiles` and `creator_profiles`.
2. `authenticated` has a `SELECT` policy on both tables.
3. `anon` has no policy on either table (and no `SELECT` grant).
4. `creator_profiles` has an `auth.uid() = user_id` self-scope policy so
   creators can only edit their own row.
5. `profiles` has an `auth.uid() = id` self-update policy.
6. `public.search_creators(...)` exists and is `EXECUTE`-able by
   `authenticated`.
7. `profiles.username` is unique case-insensitively.

If you add anonymous read access, admin write access, or a new discovery
table, extend this script in the same commit.
