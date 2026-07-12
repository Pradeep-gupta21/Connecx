-- Enable Realtime on campaign_pitches, pitch_negotiations, messages, and conversations tables safely
DO $$
BEGIN
  -- Add campaign_pitches to supabase_realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'campaign_pitches'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.campaign_pitches;
  END IF;

  -- Add pitch_negotiations to supabase_realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'pitch_negotiations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pitch_negotiations;
  END IF;

  -- Add messages to supabase_realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;

  -- Add conversations to supabase_realtime publication if not already present
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END;
$$;
