
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS payout_method_id UUID REFERENCES public.payout_methods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS withdrawals_payout_method_idx ON public.withdrawals(payout_method_id);

-- Admin action on payout methods (approve / reject / request_update)
CREATE OR REPLACE FUNCTION public.admin_review_payout_method(
  _payout_method_id UUID,
  _action TEXT,               -- 'approve' | 'reject' | 'request_update'
  _reason TEXT DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner UUID;
  _new_status public.payout_verification_status;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT user_id INTO _owner FROM public.payout_methods WHERE id = _payout_method_id;
  IF _owner IS NULL THEN RAISE EXCEPTION 'payout method not found'; END IF;

  IF _action = 'approve' THEN
    _new_status := 'verified';
  ELSIF _action = 'reject' THEN
    _new_status := 'rejected';
  ELSIF _action = 'request_update' THEN
    _new_status := 'pending';
  ELSE
    RAISE EXCEPTION 'invalid action %', _action;
  END IF;

  UPDATE public.payout_methods
     SET verification_status = _new_status,
         rejection_reason    = CASE WHEN _action = 'approve' THEN NULL ELSE _reason END,
         verified_at         = CASE WHEN _action = 'approve' THEN now() ELSE NULL END,
         verified_by         = CASE WHEN _action = 'approve' THEN auth.uid() ELSE NULL END,
         updated_at          = now()
   WHERE id = _payout_method_id;

  INSERT INTO public.activity_logs(user_id, action, entity_type, entity_id, metadata)
  VALUES (
    auth.uid(),
    'payout_method.' || _action,
    'payout_method',
    _payout_method_id,
    jsonb_build_object('owner_id', _owner, 'reason', _reason, 'new_status', _new_status)
  );

  -- notify owner
  BEGIN
    PERFORM public.notify_user(
      _owner,
      'system'::public.notification_type,
      CASE
        WHEN _action = 'approve' THEN 'Payout account verified'
        WHEN _action = 'reject'  THEN 'Payout account rejected'
        ELSE 'Payout account needs updated info'
      END,
      _reason,
      jsonb_build_object('payout_method_id', _payout_method_id, 'action', _action)
    );
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

REVOKE ALL ON FUNCTION public.admin_review_payout_method(UUID, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_payout_method(UUID, TEXT, TEXT) TO authenticated;
