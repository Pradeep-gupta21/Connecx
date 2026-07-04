
-- Public read (anon + authenticated) for the two profile media buckets
CREATE POLICY "Profile media are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id IN ('profile-pictures','profile-banners'));

-- Owner uploads (first path segment must equal auth.uid())
CREATE POLICY "Users can upload own profile media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('profile-pictures','profile-banners')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own profile media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('profile-pictures','profile-banners')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own profile media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('profile-pictures','profile-banners')
  AND (storage.foldername(name))[1] = auth.uid()::text
);
