-- Create UPDATE policy on pitch_negotiations so participants can accept/decline offers
DROP POLICY IF EXISTS "Participants can update negotiations" ON public.pitch_negotiations;
CREATE POLICY "Participants can update negotiations" 
  ON public.pitch_negotiations 
  FOR UPDATE 
  TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_pitches p
      JOIN public.campaigns c ON c.id = p.campaign_id
      WHERE p.id = pitch_negotiations.pitch_id
        AND (p.creator_id = auth.uid() OR c.advertiser_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_pitches p
      JOIN public.campaigns c ON c.id = p.campaign_id
      WHERE p.id = pitch_negotiations.pitch_id
        AND (p.creator_id = auth.uid() OR c.advertiser_id = auth.uid())
    )
  );

-- Create trigger function to handle notification on negotiation creation (new message or price proposal)
CREATE OR REPLACE FUNCTION public.handle_pitch_negotiation_created()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_id uuid;
  v_campaign_title text;
  v_sender_name text;
  v_campaign_id uuid;
BEGIN
  -- Find the other participant in the pitch (the recipient of the negotiation)
  SELECT 
    c.id,
    c.title,
    CASE 
      WHEN p.creator_id = NEW.sender_id THEN c.advertiser_id
      ELSE p.creator_id
    END
  INTO v_campaign_id, v_campaign_title, v_recipient_id
  FROM public.campaign_pitches p
  JOIN public.campaigns c ON c.id = p.campaign_id
  WHERE p.id = NEW.pitch_id;

  -- Get sender display name
  SELECT COALESCE(display_name, username, 'Someone') INTO v_sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  -- Create notification for the recipient
  INSERT INTO public.notifications (user_id, type, title, body, payload)
  VALUES (
    v_recipient_id,
    'campaign_update',
    CASE 
      WHEN NEW.proposed_price > 0 THEN 'New Price Proposal'
      ELSE 'New Negotiation Message'
    END,
    CASE 
      WHEN NEW.proposed_price > 0 THEN v_sender_name || ' proposed ₹' || NEW.proposed_price || ' for "' || v_campaign_title || '"'
      ELSE v_sender_name || ': "' || SUBSTRING(NEW.message FROM 1 FOR 100) || '"'
    END,
    jsonb_build_object(
      'pitch_id', NEW.pitch_id,
      'campaign_id', v_campaign_id,
      'proposed_price', NEW.proposed_price
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger on INSERT
DROP TRIGGER IF EXISTS tr_on_pitch_negotiation_created ON public.pitch_negotiations;
CREATE TRIGGER tr_on_pitch_negotiation_created
  AFTER INSERT ON public.pitch_negotiations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_pitch_negotiation_created();

-- Create trigger function to handle notification when proposal status changes (accepted or declined)
CREATE OR REPLACE FUNCTION public.handle_pitch_negotiation_updated()
RETURNS TRIGGER AS $$
DECLARE
  v_campaign_title text;
  v_actor_name text;
  v_campaign_id uuid;
BEGIN
  -- We only care about transitions from proposed to accepted or declined
  IF OLD.status = 'proposed' AND NEW.status <> 'proposed' THEN
    -- Get the campaign title
    SELECT c.id, c.title
    INTO v_campaign_id, v_campaign_title
    FROM public.campaign_pitches p
    JOIN public.campaigns c ON c.id = p.campaign_id
    WHERE p.id = NEW.pitch_id;

    -- Get updater display name (the one performing the update)
    SELECT COALESCE(display_name, username, 'Someone') INTO v_actor_name
    FROM public.profiles
    WHERE id = auth.uid();

    -- Create notification for the original proposer (the sender of the proposal)
    INSERT INTO public.notifications (user_id, type, title, body, payload)
    VALUES (
      NEW.sender_id,
      'campaign_update',
      CASE 
        WHEN NEW.status = 'accepted' THEN 'Proposal Accepted'
        ELSE 'Proposal Declined'
      END,
      CASE 
        WHEN NEW.status = 'accepted' THEN v_actor_name || ' accepted your offer of ₹' || NEW.proposed_price || ' for "' || v_campaign_title || '"'
        ELSE v_actor_name || ' declined your offer of ₹' || NEW.proposed_price || ' for "' || v_campaign_title || '"'
      END,
      jsonb_build_object(
        'pitch_id', NEW.pitch_id,
        'campaign_id', v_campaign_id,
        'proposed_price', NEW.proposed_price,
        'status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger on UPDATE
DROP TRIGGER IF EXISTS tr_on_pitch_negotiation_updated ON public.pitch_negotiations;
CREATE TRIGGER tr_on_pitch_negotiation_updated
  AFTER UPDATE ON public.pitch_negotiations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_pitch_negotiation_updated();
