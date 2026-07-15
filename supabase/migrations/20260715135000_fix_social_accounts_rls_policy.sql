-- Drop the old policy that restricted social accounts selection to only approved creators
DROP POLICY IF EXISTS "Own or approved-creator socials visible" ON public.social_accounts;

-- Recreate the policy to align with creator_profiles select policy,
-- allowing authenticated users to see socials of any active (non-deleted) creator profile.
CREATE POLICY "Own or active-creator socials visible"
ON public.social_accounts
FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.creator_profiles cp
      WHERE cp.user_id = social_accounts.user_id
        AND cp.deleted_at IS NULL
    )
  )
);
