
REVOKE EXECUTE ON FUNCTION public.notify_on_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_pin_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_message_edit() FROM PUBLIC, anon, authenticated;
