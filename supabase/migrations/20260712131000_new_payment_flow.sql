-- Drop dependent RLS policy on campaigns
DROP POLICY IF EXISTS "Non-draft campaigns are visible to everyone" ON public.campaigns;

-- 1. Alter campaigns status column type from enum to text for flexibility
ALTER TABLE public.campaigns ALTER COLUMN status TYPE text USING status::text;

-- Recreate campaigns RLS policy with text comparison
CREATE POLICY "Non-draft campaigns are visible to everyone" 
  ON public.campaigns 
  FOR SELECT 
  TO authenticated 
  USING ((deleted_at IS NULL) AND ((status <> 'draft') OR (auth.uid() = advertiser_id)));

-- 2. Alter contracts status column type from enum to text
ALTER TABLE public.contracts ALTER COLUMN status TYPE text USING status::text;

-- 3. Alter payments status column type from enum to text
ALTER TABLE public.payments ALTER COLUMN status TYPE text USING status::text;

-- 4. Alter applications table to campaign_pitches
ALTER TABLE public.applications RENAME TO campaign_pitches;
ALTER TABLE public.campaign_pitches RENAME COLUMN pitch TO cover_message;

-- Add new columns for campaign pitches
ALTER TABLE public.campaign_pitches 
  ADD COLUMN IF NOT EXISTS deliverables text,
  ADD COLUMN IF NOT EXISTS timeline text,
  ADD COLUMN IF NOT EXISTS quoted_price numeric(10, 2) NOT NULL DEFAULT 100.00,
  ADD COLUMN IF NOT EXISTS final_price numeric(10, 2),
  ADD COLUMN IF NOT EXISTS portfolio_url text,
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Update status check constraint for campaign pitches
ALTER TABLE public.campaign_pitches ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.campaign_pitches DROP CONSTRAINT IF EXISTS campaign_pitches_status_check;
ALTER TABLE public.campaign_pitches ADD CONSTRAINT campaign_pitches_status_check CHECK (status IN ('submitted', 'under_review', 'negotiating', 'accepted', 'rejected', 'withdrawn', 'expired'));

-- Create backward-compatible VIEW for applications
CREATE OR REPLACE VIEW public.applications AS 
SELECT 
  id,
  campaign_id,
  creator_id,
  cover_message AS pitch,
  status,
  created_at,
  updated_at,
  deleted_at,
  withdrawn_at
FROM public.campaign_pitches;

-- 5. Create pitch_negotiations table
CREATE TABLE IF NOT EXISTS public.pitch_negotiations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pitch_id uuid REFERENCES public.campaign_pitches(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text,
  proposed_price numeric(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'accepted', 'declined')),
  created_at timestamp with time zone DEFAULT now()
);

-- 6. Expand payments table with pitch_id, advertiser_id, creator_id
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS pitch_id uuid REFERENCES public.campaign_pitches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS advertiser_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 7. Create payment_events (audit log history) table
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  pitch_id uuid REFERENCES public.campaign_pitches(id) ON DELETE SET NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- 8. Add unique constraint on active campaign pitches
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_campaign_pitch_idx 
  ON public.campaign_pitches (campaign_id, creator_id) 
  WHERE (deleted_at IS NULL AND status NOT IN ('withdrawn', 'rejected'));

-- 9. Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS campaign_pitches_campaign_id_idx ON public.campaign_pitches(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_pitches_creator_id_idx ON public.campaign_pitches(creator_id);
CREATE INDEX IF NOT EXISTS pitch_negotiations_pitch_id_idx ON public.pitch_negotiations(pitch_id);
CREATE INDEX IF NOT EXISTS payments_pitch_id_idx ON public.payments(pitch_id);
CREATE INDEX IF NOT EXISTS payment_events_campaign_id_idx ON public.payment_events(campaign_id);

-- 10. Enable RLS on new tables
ALTER TABLE public.pitch_negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- 11. Define RLS Policies
-- Pitch negotiations
CREATE POLICY "Participants can view negotiations" 
  ON public.pitch_negotiations 
  FOR SELECT 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_pitches p
      JOIN public.campaigns c ON c.id = p.campaign_id
      WHERE p.id = pitch_negotiations.pitch_id
        AND (p.creator_id = auth.uid() OR c.advertiser_id = auth.uid())
    )
  );

CREATE POLICY "Participants can insert negotiations" 
  ON public.pitch_negotiations 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.campaign_pitches p
      JOIN public.campaigns c ON c.id = p.campaign_id
      WHERE p.id = pitch_negotiations.pitch_id
        AND (p.creator_id = auth.uid() OR c.advertiser_id = auth.uid())
    )
  );

-- Payment events (audit log)
CREATE POLICY "Anyone authenticated can view payment events" 
  ON public.payment_events 
  FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "System can insert payment events" 
  ON public.payment_events 
  FOR INSERT 
  TO authenticated 
  WITH CHECK (true);
