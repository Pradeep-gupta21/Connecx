
-- Edit history for messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_count INT NOT NULL DEFAULT 0;

-- Extend notification types
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'mention';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'pin_update';

-- Trigger: notify other participant on new message (mention if @displayname matched)
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  convo RECORD;
  recipient UUID;
  sender_name TEXT;
  recipient_name TEXT;
  ntype public.notification_type := 'new_message';
  preview TEXT;
BEGIN
  SELECT * INTO convo FROM public.conversations WHERE id = NEW.conversation_id;
  IF convo IS NULL THEN RETURN NEW; END IF;
  recipient := CASE WHEN NEW.sender_id = convo.advertiser_id THEN convo.creator_id ELSE convo.advertiser_id END;
  IF recipient IS NULL OR recipient = NEW.sender_id THEN RETURN NEW; END IF;

  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;
  SELECT display_name INTO recipient_name FROM public.profiles WHERE id = recipient;

  IF recipient_name IS NOT NULL AND NEW.body ILIKE '%@' || recipient_name || '%' THEN
    ntype := 'mention';
  END IF;

  preview := COALESCE(NULLIF(NEW.body, ''), '(attachment)');
  IF length(preview) > 120 THEN preview := left(preview, 117) || '…'; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, payload)
  VALUES (
    recipient,
    ntype,
    CASE WHEN ntype = 'mention' THEN COALESCE(sender_name, 'Someone') || ' mentioned you'
         ELSE 'New message from ' || COALESCE(sender_name, 'someone') END,
    preview,
    jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id, 'sender_id', NEW.sender_id)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_on_message ON public.messages;
CREATE TRIGGER trg_notify_on_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- Trigger: notify participants on pin change
CREATE OR REPLACE FUNCTION public.notify_on_pin_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  convo RECORD;
  other UUID;
  actor_name TEXT;
  preview TEXT;
BEGIN
  IF NEW.pinned IS NOT DISTINCT FROM OLD.pinned THEN RETURN NEW; END IF;
  SELECT * INTO convo FROM public.conversations WHERE id = NEW.conversation_id;
  IF convo IS NULL THEN RETURN NEW; END IF;
  other := CASE WHEN auth.uid() = convo.advertiser_id THEN convo.creator_id ELSE convo.advertiser_id END;
  IF other IS NULL THEN RETURN NEW; END IF;

  SELECT display_name INTO actor_name FROM public.profiles WHERE id = auth.uid();
  preview := COALESCE(NULLIF(NEW.body, ''), '(attachment)');
  IF length(preview) > 100 THEN preview := left(preview, 97) || '…'; END IF;

  INSERT INTO public.notifications (user_id, type, title, body, payload)
  VALUES (
    other,
    'pin_update',
    COALESCE(actor_name, 'Someone') || (CASE WHEN NEW.pinned THEN ' pinned a message' ELSE ' unpinned a message' END),
    preview,
    jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id, 'pinned', NEW.pinned)
  );
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_on_pin_change ON public.messages;
CREATE TRIGGER trg_notify_on_pin_change
AFTER UPDATE OF pinned ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_pin_change();

-- Trigger: bump edit metadata on body change
CREATE OR REPLACE FUNCTION public.bump_message_edit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.body IS DISTINCT FROM OLD.body THEN
    NEW.edited_at := now();
    NEW.edit_count := COALESCE(OLD.edit_count, 0) + 1;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bump_message_edit ON public.messages;
CREATE TRIGGER trg_bump_message_edit
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_message_edit();
