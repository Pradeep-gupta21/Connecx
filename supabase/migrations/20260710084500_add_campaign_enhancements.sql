ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS content_types text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS creators_required integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS accepted_creators_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_provided boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS product_value numeric,
  ADD COLUMN IF NOT EXISTS shipping_regions text,
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'fixed_payment',
  ADD COLUMN IF NOT EXISTS commission_details text,
  ADD COLUMN IF NOT EXISTS application_deadline date,
  ADD COLUMN IF NOT EXISTS content_delivery_deadline date,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'draft';

UPDATE public.campaigns
SET content_types = COALESCE(content_types, '{}'::text[]),
    creators_required = COALESCE(creators_required, 1),
    accepted_creators_count = COALESCE(accepted_creators_count, 0),
    product_provided = COALESCE(product_provided, false),
    payment_type = COALESCE(payment_type, 'fixed_payment'),
    visibility = COALESCE(visibility, 'public'),
    publication_status = COALESCE(publication_status, CASE WHEN status = 'open' THEN 'published' ELSE 'draft' END)
WHERE id IS NOT NULL;
