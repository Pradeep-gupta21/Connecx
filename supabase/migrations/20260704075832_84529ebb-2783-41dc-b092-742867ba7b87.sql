
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS banner_position jsonb NOT NULL DEFAULT '{"x":50,"y":50,"zoom":1}'::jsonb,
  ADD COLUMN IF NOT EXISTS avatar_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS banner_updated_at timestamptz;
