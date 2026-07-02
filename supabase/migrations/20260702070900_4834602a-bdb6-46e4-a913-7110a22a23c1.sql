
CREATE POLICY "Participants can read message attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'message-attachments' AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = split_part(name, '/', 1)
      AND (c.advertiser_id = auth.uid() OR c.creator_id = auth.uid())
  ));

CREATE POLICY "Participants can upload message attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-attachments' AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id::text = split_part(name, '/', 1)
      AND (c.advertiser_id = auth.uid() OR c.creator_id = auth.uid())
  ));
