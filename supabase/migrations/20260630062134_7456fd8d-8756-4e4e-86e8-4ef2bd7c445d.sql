
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_advertiser_profile_fkey
  FOREIGN KEY (advertiser_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.applications
  ADD CONSTRAINT applications_creator_profile_fkey
  FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_advertiser_profile_fkey
  FOREIGN KEY (advertiser_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_creator_profile_fkey
  FOREIGN KEY (creator_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.creator_profiles
  ADD CONSTRAINT creator_profiles_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.advertiser_profiles
  ADD CONSTRAINT advertiser_profiles_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
