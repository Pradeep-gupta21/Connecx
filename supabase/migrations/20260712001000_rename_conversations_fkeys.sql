-- Rename the foreign key constraints on the conversations table to match the frontend queries and types
ALTER TABLE public.conversations 
  RENAME CONSTRAINT conversations_advertiser_id_fkey TO conversations_advertiser_profile_fkey;

ALTER TABLE public.conversations 
  RENAME CONSTRAINT conversations_creator_id_fkey TO conversations_creator_profile_fkey;
