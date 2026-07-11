-- Drop duplicate foreign key constraints to prevent PostgREST embedding errors
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_advertiser_profile_fkey;
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_campaign_fkey;
ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_creator_profile_fkey;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_advertiser_profile_fkey;
ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_creator_profile_fkey;
ALTER TABLE public.creator_profiles DROP CONSTRAINT IF EXISTS creator_profiles_profile_fkey;
ALTER TABLE public.advertiser_profiles DROP CONSTRAINT IF EXISTS advertiser_profiles_profile_fkey;
