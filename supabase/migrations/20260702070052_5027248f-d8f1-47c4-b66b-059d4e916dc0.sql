
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel='paused' AND enumtypid='public.campaign_status'::regtype) THEN
    ALTER TYPE public.campaign_status ADD VALUE 'paused';
  END IF;
END $$;

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS creator_tier text,
  ADD COLUMN IF NOT EXISTS deliverables text,
  ADD COLUMN IF NOT EXISTS languages text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS requirements text,
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
