
-- =========================================================================
-- BrandBridge scalable schema: soft-delete + new tables + indexes + RLS
-- =========================================================================

-- ---------- Enums ----------
DO $$ BEGIN CREATE TYPE public.contract_status AS ENUM ('draft','sent','signed','active','completed','cancelled','disputed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_status  AS ENUM ('pending','processing','succeeded','failed','refunded','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.payment_type    AS ENUM ('deposit','milestone','final','bonus','refund'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.verification_status AS ENUM ('pending','approved','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.verification_kind   AS ENUM ('identity','brand','social','payout'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.social_platform     AS ENUM ('instagram','tiktok','youtube','twitter','twitch','linkedin','facebook','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.media_kind          AS ENUM ('image','video','audio','document'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- Soft-delete columns on existing tables ----------
ALTER TABLE public.profiles              ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.user_roles            ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.creator_profiles      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.advertiser_profiles   ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.campaigns             ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.applications          ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.conversations         ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.messages              ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.notifications         ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Helpful indexes on existing tables
CREATE INDEX IF NOT EXISTS idx_campaigns_advertiser  ON public.campaigns(advertiser_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_status      ON public.campaigns(status)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_applications_campaign ON public.applications(campaign_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_applications_creator  ON public.applications(creator_id)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON public.notifications(user_id, created_at DESC) WHERE deleted_at IS NULL;

-- ============================ CONTRACTS =================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  advertiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  title text NOT NULL,
  terms text,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  status public.contract_status NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  signed_by_advertiser_at timestamptz,
  signed_by_creator_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contracts TO authenticated;
GRANT ALL ON public.contracts TO service_role;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Contract parties can view" ON public.contracts FOR SELECT TO authenticated USING (deleted_at IS NULL AND (auth.uid() = advertiser_id OR auth.uid() = creator_id));
CREATE POLICY "Advertisers create contracts"  ON public.contracts FOR INSERT TO authenticated WITH CHECK (auth.uid() = advertiser_id);
CREATE POLICY "Parties update contracts"      ON public.contracts FOR UPDATE TO authenticated USING (auth.uid() = advertiser_id OR auth.uid() = creator_id) WITH CHECK (auth.uid() = advertiser_id OR auth.uid() = creator_id);
CREATE INDEX idx_contracts_campaign     ON public.contracts(campaign_id)   WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_advertiser   ON public.contracts(advertiser_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_creator      ON public.contracts(creator_id)    WHERE deleted_at IS NULL;
CREATE INDEX idx_contracts_status       ON public.contracts(status)        WHERE deleted_at IS NULL;

-- ============================ PAYMENTS =================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  payee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'USD',
  type public.payment_type NOT NULL DEFAULT 'milestone',
  status public.payment_status NOT NULL DEFAULT 'pending',
  provider text,
  provider_ref text,
  processed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Payment parties view"      ON public.payments FOR SELECT TO authenticated USING (deleted_at IS NULL AND (auth.uid() = payer_id OR auth.uid() = payee_id));
CREATE POLICY "Payer creates payment"     ON public.payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = payer_id);
CREATE POLICY "Payer updates own payment" ON public.payments FOR UPDATE TO authenticated USING (auth.uid() = payer_id) WITH CHECK (auth.uid() = payer_id);
CREATE INDEX idx_payments_contract ON public.payments(contract_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_payer    ON public.payments(payer_id)    WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_payee    ON public.payments(payee_id)    WHERE deleted_at IS NULL;
CREATE INDEX idx_payments_status   ON public.payments(status)      WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX idx_payments_provider_ref ON public.payments(provider, provider_ref) WHERE provider_ref IS NOT NULL;

-- ============================ REVIEWS =================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES public.contracts(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  reviewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT reviews_no_self CHECK (reviewer_id <> reviewee_id),
  UNIQUE (contract_id, reviewer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reviews visible"    ON public.reviews FOR SELECT TO authenticated USING (deleted_at IS NULL AND (is_public OR auth.uid() = reviewer_id OR auth.uid() = reviewee_id));
CREATE POLICY "Reviewer creates review"   ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Reviewer updates own"      ON public.reviews FOR UPDATE TO authenticated USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Reviewer deletes own"      ON public.reviews FOR DELETE TO authenticated USING (auth.uid() = reviewer_id);
CREATE INDEX idx_reviews_reviewee ON public.reviews(reviewee_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_reviewer ON public.reviews(reviewer_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_reviews_campaign ON public.reviews(campaign_id) WHERE deleted_at IS NULL;

-- ============================ SAVED_CAMPAIGNS =================================
CREATE TABLE IF NOT EXISTS public.saved_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id, campaign_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_campaigns TO authenticated;
GRANT ALL ON public.saved_campaigns TO service_role;
ALTER TABLE public.saved_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages saved campaigns" ON public.saved_campaigns FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_saved_campaigns_user ON public.saved_campaigns(user_id) WHERE deleted_at IS NULL;

-- ============================ SAVED_CREATORS =================================
CREATE TABLE IF NOT EXISTS public.saved_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id, creator_id),
  CONSTRAINT saved_creators_no_self CHECK (user_id <> creator_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_creators TO authenticated;
GRANT ALL ON public.saved_creators TO service_role;
ALTER TABLE public.saved_creators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages saved creators" ON public.saved_creators FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_saved_creators_user ON public.saved_creators(user_id) WHERE deleted_at IS NULL;

-- ============================ MEDIA_FILES =================================
CREATE TABLE IF NOT EXISTS public.media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  path text NOT NULL,
  kind public.media_kind NOT NULL DEFAULT 'image',
  mime_type text,
  size_bytes bigint CHECK (size_bytes IS NULL OR size_bytes >= 0),
  width int, height int, duration_ms int,
  is_public boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (bucket, path)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_files TO authenticated;
GRANT ALL ON public.media_files TO service_role;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public or owner reads media" ON public.media_files FOR SELECT TO authenticated USING (deleted_at IS NULL AND (is_public OR auth.uid() = owner_id));
CREATE POLICY "Owner manages media"         ON public.media_files FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates media"         ON public.media_files FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner deletes media"         ON public.media_files FOR DELETE TO authenticated USING (auth.uid() = owner_id);
CREATE INDEX idx_media_owner ON public.media_files(owner_id) WHERE deleted_at IS NULL;

-- ============================ PORTFOLIO =================================
CREATE TABLE IF NOT EXISTS public.portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_media_id uuid REFERENCES public.media_files(id) ON DELETE SET NULL,
  external_url text,
  tags text[] NOT NULL DEFAULT '{}',
  position int NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio TO authenticated;
GRANT ALL ON public.portfolio TO service_role;
ALTER TABLE public.portfolio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public or owner portfolio" ON public.portfolio FOR SELECT TO authenticated USING (deleted_at IS NULL AND (is_public OR auth.uid() = creator_id));
CREATE POLICY "Owner manages portfolio"   ON public.portfolio FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Owner updates portfolio"   ON public.portfolio FOR UPDATE TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Owner deletes portfolio"   ON public.portfolio FOR DELETE TO authenticated USING (auth.uid() = creator_id);
CREATE INDEX idx_portfolio_creator ON public.portfolio(creator_id, position) WHERE deleted_at IS NULL;

-- ============================ SOCIAL_ACCOUNTS =================================
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform public.social_platform NOT NULL,
  handle text NOT NULL,
  url text,
  follower_count int CHECK (follower_count IS NULL OR follower_count >= 0),
  engagement_rate numeric(6,4),
  verified boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id, platform, handle)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_accounts TO authenticated;
GRANT ALL ON public.social_accounts TO service_role;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone sees social accounts" ON public.social_accounts FOR SELECT TO authenticated USING (deleted_at IS NULL);
CREATE POLICY "Owner manages social"        ON public.social_accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates social"        ON public.social_accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner deletes social"        ON public.social_accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_social_user ON public.social_accounts(user_id) WHERE deleted_at IS NULL;

-- ============================ VERIFICATION_REQUESTS =================================
CREATE TABLE IF NOT EXISTS public.verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind public.verification_kind NOT NULL,
  status public.verification_status NOT NULL DEFAULT 'pending',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_requests TO authenticated;
GRANT ALL ON public.verification_requests TO service_role;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own verifications" ON public.verification_requests FOR SELECT TO authenticated USING (deleted_at IS NULL AND auth.uid() = user_id);
CREATE POLICY "Owner creates verification"    ON public.verification_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates pending"         ON public.verification_requests FOR UPDATE TO authenticated USING (auth.uid() = user_id AND status = 'pending') WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_verification_user ON public.verification_requests(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_verification_status ON public.verification_requests(status) WHERE deleted_at IS NULL;

-- ============================ ACTIVITY_LOGS =================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  ip_address inet,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner reads own activity"  ON public.activity_logs FOR SELECT TO authenticated USING (deleted_at IS NULL AND auth.uid() = user_id);
CREATE POLICY "Owner writes own activity" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_activity_user_time ON public.activity_logs(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_activity_entity    ON public.activity_logs(entity_type, entity_id)   WHERE deleted_at IS NULL;

-- ---------- updated_at triggers ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contracts','payments','reviews','saved_campaigns','saved_creators',
    'media_files','portfolio','social_accounts','verification_requests','activity_logs'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END $$;
