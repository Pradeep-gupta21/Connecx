-- 1. Merge duplicate conversations safely and preserve all messages
DO $$
DECLARE
  r RECORD;
  primary_id uuid;
BEGIN
  -- Find duplicate conversations based on participant pair and campaign
  FOR r IN 
    SELECT 
      LEAST(advertiser_id, creator_id) as u1, 
      GREATEST(advertiser_id, creator_id) as u2, 
      campaign_id, 
      count(*) 
    FROM public.conversations 
    GROUP BY LEAST(advertiser_id, creator_id), GREATEST(advertiser_id, creator_id), campaign_id
    HAVING count(*) > 1
  LOOP
    -- Select the oldest conversation in the duplicate group as the primary
    SELECT id INTO primary_id 
    FROM public.conversations
    WHERE LEAST(advertiser_id, creator_id) = r.u1 
      AND GREATEST(advertiser_id, creator_id) = r.u2
      AND (campaign_id = r.campaign_id OR (campaign_id IS NULL AND r.campaign_id IS NULL))
    ORDER BY created_at ASC
    LIMIT 1;

    -- Re-reference messages from duplicates to the primary conversation
    UPDATE public.messages
    SET conversation_id = primary_id
    WHERE conversation_id IN (
      SELECT id FROM public.conversations
      WHERE LEAST(advertiser_id, creator_id) = r.u1 
        AND GREATEST(advertiser_id, creator_id) = r.u2
        AND (campaign_id = r.campaign_id OR (campaign_id IS NULL AND r.campaign_id IS NULL))
        AND id != primary_id
    );

    -- Delete duplicate conversation records
    DELETE FROM public.conversations
    WHERE LEAST(advertiser_id, creator_id) = r.u1 
      AND GREATEST(advertiser_id, creator_id) = r.u2
      AND (campaign_id = r.campaign_id OR (campaign_id IS NULL AND r.campaign_id IS NULL))
      AND id != primary_id;
  END LOOP;
END $$;

-- 2. Add unique constraints to prevent duplicate conversations in the future
CREATE UNIQUE INDEX IF NOT EXISTS unique_conversation_participants_idx 
  ON public.conversations (
    LEAST(advertiser_id, creator_id), 
    GREATEST(advertiser_id, creator_id)
  )
  WHERE campaign_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS unique_campaign_conversation_participants_idx 
  ON public.conversations (
    LEAST(advertiser_id, creator_id), 
    GREATEST(advertiser_id, creator_id),
    campaign_id
  )
  WHERE campaign_id IS NOT NULL;

-- 3. Audit and expand the messages table schema
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'seen')),
  ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS seen_at timestamp with time zone;

-- Backfill recipient_id for existing messages
UPDATE public.messages m
SET recipient_id = CASE 
  WHEN m.sender_id = c.advertiser_id THEN c.creator_id
  ELSE c.advertiser_id
END
FROM public.conversations c
WHERE m.conversation_id = c.id AND m.recipient_id IS NULL;

-- Backfill read status, seen_at, and delivered_at for existing read messages
UPDATE public.messages 
SET seen_at = read_at, 
    status = 'seen', 
    delivered_at = COALESCE(read_at, created_at)
WHERE read_at IS NOT NULL;

-- If a message was sent but not read, set status to 'sent' or 'delivered'
UPDATE public.messages
SET status = 'sent',
    delivered_at = created_at
WHERE read_at IS NULL AND status = 'sent';

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS messages_recipient_id_idx ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS messages_status_idx ON public.messages(status);
CREATE INDEX IF NOT EXISTS conversations_participants_idx ON public.conversations(advertiser_id, creator_id);
