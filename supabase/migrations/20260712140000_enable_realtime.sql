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

-- Fix the guard_contract_from_withdrawn_app trigger function to compare status as text
CREATE OR REPLACE FUNCTION public.guard_contract_from_withdrawn_app()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.campaign_id = NEW.campaign_id
      AND a.creator_id  = NEW.creator_id
      AND a.status = 'withdrawn'
  ) THEN
    RAISE EXCEPTION 'Cannot create contract: creator has withdrawn from this campaign';
  END IF;
  RETURN NEW;
END;
$function$;

-- Fix the guard_application_withdrawn_lock trigger function to compare status as text
CREATE OR REPLACE FUNCTION public.guard_application_withdrawn_lock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'withdrawn'
       AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Application has been withdrawn by the creator and cannot be modified';
    END IF;
    IF NEW.status = 'withdrawn'
       AND OLD.status IS DISTINCT FROM NEW.status
       AND NEW.withdrawn_at IS NULL THEN
      NEW.withdrawn_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
