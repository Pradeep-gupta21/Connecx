-- Clean up existing onboarded profiles that violate the new constraints
UPDATE public.profiles
SET 
  username = COALESCE(username, 'user_' || substring(id::text from 1 for 8)),
  bio = COALESCE(bio, 'No bio provided.')
WHERE onboarded = true AND (username IS NULL OR bio IS NULL OR display_name IS NULL);

-- Add the check constraint to enforce display_name, username, and bio when onboarded is true
ALTER TABLE public.profiles ADD CONSTRAINT check_onboarded_fields CHECK (
  NOT onboarded OR (
    display_name IS NOT NULL AND length(trim(display_name)) > 0 AND
    username IS NOT NULL AND length(trim(username)) > 0 AND
    bio IS NOT NULL AND length(trim(bio)) > 0
  )
);
