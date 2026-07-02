REVOKE ALL ON FUNCTION public.ensure_wallet(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_wallet_txn(uuid, public.wallet_txn_type, numeric, text, uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_wallet(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_wallet_txn(uuid, public.wallet_txn_type, numeric, text, uuid, text, jsonb) TO service_role;