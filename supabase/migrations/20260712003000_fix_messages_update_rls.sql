-- Drop the restrictive update policy that prevents recipients from marking messages as read
DROP POLICY IF EXISTS "Senders can update own messages" ON public.messages;

-- Create a new update policy that allows both the sender and recipient to update messages
CREATE POLICY "Participants can update messages" 
  ON public.messages 
  FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id = messages.conversation_id 
        AND (c.advertiser_id = auth.uid() OR c.creator_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id = messages.conversation_id 
        AND (c.advertiser_id = auth.uid() OR c.creator_id = auth.uid())
    )
  );
