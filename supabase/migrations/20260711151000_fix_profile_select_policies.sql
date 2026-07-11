-- Add public SELECT policies for creator_profiles and advertiser_profiles to allow standard users to read them.
DO $$ BEGIN
  CREATE POLICY "Creator profiles are readable by everyone" ON public.creator_profiles FOR SELECT TO authenticated USING (deleted_at IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Advertiser profiles are readable by everyone" ON public.advertiser_profiles FOR SELECT TO authenticated USING (deleted_at IS NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
