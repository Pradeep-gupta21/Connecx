-- 1. RLS Policies for Campaigns
DO $$ BEGIN
  CREATE POLICY "Non-draft campaigns are visible to everyone" ON public.campaigns FOR SELECT USING (deleted_at IS NULL AND (status != 'draft'::public.campaign_status OR auth.uid() = advertiser_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Advertisers can insert campaigns" ON public.campaigns FOR INSERT TO authenticated WITH CHECK (auth.uid() = advertiser_id AND public.has_role(auth.uid(), 'advertiser'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Advertisers can update own campaigns" ON public.campaigns FOR UPDATE TO authenticated USING (auth.uid() = advertiser_id) WITH CHECK (auth.uid() = advertiser_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Advertisers can delete own campaigns" ON public.campaigns FOR DELETE TO authenticated USING (auth.uid() = advertiser_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 2. RLS Policies for Applications
DO $$ BEGIN
  CREATE POLICY "Users can view applications they are involved in" ON public.applications FOR SELECT TO authenticated
    USING (deleted_at IS NULL AND (auth.uid() = creator_id OR EXISTS (
      SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.advertiser_id = auth.uid()
    )));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Creators can insert applications" ON public.applications FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = creator_id AND public.has_role(auth.uid(), 'creator'::public.app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update applications they are involved in" ON public.applications FOR UPDATE TO authenticated
    USING (auth.uid() = creator_id OR EXISTS (
      SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.advertiser_id = auth.uid()
    ))
    WITH CHECK (auth.uid() = creator_id OR EXISTS (
      SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.advertiser_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Creators can delete own applications" ON public.applications FOR DELETE TO authenticated
    USING (auth.uid() = creator_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 3. RLS Policies for Conversations
DO $$ BEGIN
  CREATE POLICY "Participants can view conversations" ON public.conversations FOR SELECT TO authenticated
    USING (deleted_at IS NULL AND (auth.uid() = advertiser_id OR auth.uid() = creator_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Participants can insert conversations" ON public.conversations FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = advertiser_id OR auth.uid() = creator_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Participants can update conversations" ON public.conversations FOR UPDATE TO authenticated
    USING (auth.uid() = advertiser_id OR auth.uid() = creator_id)
    WITH CHECK (auth.uid() = advertiser_id OR auth.uid() = creator_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Participants can delete conversations" ON public.conversations FOR DELETE TO authenticated
    USING (auth.uid() = advertiser_id OR auth.uid() = creator_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 4. RLS Policies for Messages
DO $$ BEGIN
  CREATE POLICY "Participants can view messages" ON public.messages FOR SELECT TO authenticated
    USING (deleted_at IS NULL AND EXISTS (
      SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.advertiser_id = auth.uid() OR c.creator_id = auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Participants can insert messages" ON public.messages FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = sender_id AND EXISTS (
      SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.advertiser_id = auth.uid() OR c.creator_id = auth.uid())
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Senders can update own messages" ON public.messages FOR UPDATE TO authenticated
    USING (auth.uid() = sender_id)
    WITH CHECK (auth.uid() = sender_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Senders can delete own messages" ON public.messages FOR DELETE TO authenticated
    USING (auth.uid() = sender_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 5. RLS Policies for Notifications
DO $$ BEGIN
  CREATE POLICY "Users can read their own notifications" ON public.notifications FOR SELECT TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
