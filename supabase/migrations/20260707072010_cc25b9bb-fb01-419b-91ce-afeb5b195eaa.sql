
ALTER TABLE public.applications ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;

CREATE OR REPLACE FUNCTION public.guard_application_withdrawn_lock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'withdrawn'::public.application_status
       AND NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Application has been withdrawn by the creator and cannot be modified';
    END IF;
    IF NEW.status = 'withdrawn'::public.application_status
       AND OLD.status IS DISTINCT FROM NEW.status
       AND NEW.withdrawn_at IS NULL THEN
      NEW.withdrawn_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_application_withdrawn_lock ON public.applications;
CREATE TRIGGER guard_application_withdrawn_lock
BEFORE UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.guard_application_withdrawn_lock();

-- Also block new contracts against a withdrawn application (matched by campaign+creator).
CREATE OR REPLACE FUNCTION public.guard_contract_from_withdrawn_app()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.applications a
    WHERE a.campaign_id = NEW.campaign_id
      AND a.creator_id  = NEW.creator_id
      AND a.status = 'withdrawn'::public.application_status
  ) THEN
    RAISE EXCEPTION 'Cannot create contract: creator has withdrawn from this campaign';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_contract_from_withdrawn_app ON public.contracts;
CREATE TRIGGER guard_contract_from_withdrawn_app
BEFORE INSERT ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.guard_contract_from_withdrawn_app();
