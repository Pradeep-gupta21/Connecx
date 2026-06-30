
CREATE POLICY "Authenticated can read brandbridge buckets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id IN ('avatars','portfolios','brand-logos','campaign-covers'));

CREATE POLICY "Users can upload to their own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('avatars','portfolios','brand-logos','campaign-covers')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('avatars','portfolios','brand-logos','campaign-covers')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('avatars','portfolios','brand-logos','campaign-covers')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
