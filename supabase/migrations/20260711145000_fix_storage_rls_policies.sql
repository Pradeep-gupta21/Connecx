-- Drop old restrictive storage policies
DROP POLICY IF EXISTS "Authenticated can read brandbridge buckets" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create new SELECT policy for public/authenticated reads
CREATE POLICY "Public read access for covers and media"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('avatars', 'brand-logos', 'campaign-covers', 'profile-pictures', 'profile-banners'));

CREATE POLICY "Authenticated read access for portfolios and messages"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('portfolios', 'message-attachments'));

-- Create new INSERT/UPDATE/DELETE policies for authenticated users
CREATE POLICY "Authenticated users can upload objects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN ('avatars', 'brand-logos', 'campaign-covers', 'profile-pictures', 'profile-banners', 'portfolios', 'message-attachments'));

CREATE POLICY "Authenticated users can update objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id IN ('avatars', 'brand-logos', 'campaign-covers', 'profile-pictures', 'profile-banners', 'portfolios', 'message-attachments'))
  WITH CHECK (bucket_id IN ('avatars', 'brand-logos', 'campaign-covers', 'profile-pictures', 'profile-banners', 'portfolios', 'message-attachments'));

CREATE POLICY "Authenticated users can delete objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id IN ('avatars', 'brand-logos', 'campaign-covers', 'profile-pictures', 'profile-banners', 'portfolios', 'message-attachments'));
