-- Create base enums
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('advertiser', 'creator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.application_status AS ENUM ('pending', 'accepted', 'rejected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.campaign_status AS ENUM ('draft', 'open', 'closed', 'archived', 'paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'application_received',
    'application_status',
    'new_message',
    'campaign_update',
    'system',
    'mention',
    'pin_update',
    'payment_success',
    'campaign_funded',
    'creator_accepted',
    'deliverables_uploaded',
    'revision_requested',
    'payment_released',
    'withdrawal_approved',
    'withdrawal_completed',
    'refund_completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create placeholder functions so early drop policy/revokes don't fail
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.bump_conversation_last_message() RETURNS trigger AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean AS $$
BEGIN
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Create missing base tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  display_name text,
  avatar_url text,
  country text,
  phone text,
  active_role public.app_role,
  bio text,
  location text,
  onboarded boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,
  avatar_updated_at timestamptz,
  banner_url text,
  banner_position jsonb DEFAULT '{}'::jsonb NOT NULL,
  banner_updated_at timestamptz,
  suspended_at timestamptz,
  suspended_reason text
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.advertiser_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  brand_name text,
  logo_url text,
  website text,
  about text,
  industry text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.creator_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline text,
  available boolean DEFAULT true NOT NULL,
  categories text[] DEFAULT '{}'::text[] NOT NULL,
  languages text[] DEFAULT '{}'::text[] NOT NULL,
  socials jsonb DEFAULT '{}'::jsonb NOT NULL,
  pricing jsonb DEFAULT '{}'::jsonb NOT NULL,
  portfolio_media jsonb DEFAULT '{}'::jsonb NOT NULL,
  follower_count integer DEFAULT 0,
  rate_min numeric,
  rate_max numeric,
  availability_status text DEFAULT 'available' NOT NULL,
  analytics jsonb DEFAULT '{}'::jsonb NOT NULL,
  audience_demographics jsonb DEFAULT '{}'::jsonb NOT NULL,
  past_collaborations jsonb DEFAULT '{}'::jsonb NOT NULL,
  profile_slug text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  advertiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  brief text,
  category text,
  budget_min numeric,
  budget_max numeric,
  languages text[] DEFAULT '{}'::text[],
  location text,
  platform text,
  requirements text,
  status public.campaign_status DEFAULT 'draft'::public.campaign_status NOT NULL,
  cover_url text,
  deliverables text,
  deadline date,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,
  attachments jsonb DEFAULT '[]'::jsonb,
  creator_tier text,
  funded boolean DEFAULT false NOT NULL,
  funded_amount numeric,
  funded_at timestamptz,
  funded_payment_id uuid,
  gst_pct numeric DEFAULT 18 NOT NULL,
  platform_fee_pct numeric DEFAULT 10 NOT NULL
);

CREATE TABLE IF NOT EXISTS public.applications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pitch text,
  status public.application_status DEFAULT 'pending'::public.application_status NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz,
  withdrawn_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  advertiser_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
  message_type text DEFAULT 'text' NOT NULL,
  pinned boolean DEFAULT false NOT NULL,
  pinned_at timestamptz,
  edit_count integer DEFAULT 0 NOT NULL,
  edited_at timestamptz,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type public.notification_type NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  deleted_at timestamptz
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertiser_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Initialize storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('portfolios', 'portfolios', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-logos', 'brand-logos', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-covers', 'campaign-covers', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('message-attachments', 'message-attachments', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-pictures', 'profile-pictures', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-banners', 'profile-banners', true) ON CONFLICT (id) DO NOTHING;
