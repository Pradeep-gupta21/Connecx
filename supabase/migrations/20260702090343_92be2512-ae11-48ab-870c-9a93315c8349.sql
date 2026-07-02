
CREATE OR REPLACE FUNCTION public.next_receipt_number()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'RCPT-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.receipt_seq')::text,6,'0');
$$;
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public AS $$
  SELECT 'INV-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.invoice_seq')::text,6,'0');
$$;
REVOKE ALL ON FUNCTION public.next_receipt_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.next_invoice_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_receipt_number() TO service_role;
GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO service_role;
