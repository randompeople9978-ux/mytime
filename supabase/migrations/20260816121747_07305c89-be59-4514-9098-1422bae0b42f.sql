REVOKE EXECUTE ON FUNCTION public.push_notification(uuid, uuid, text, text, text, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_friendship() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_follow() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_dm() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.tg_notify_call() FROM anon, authenticated, public;