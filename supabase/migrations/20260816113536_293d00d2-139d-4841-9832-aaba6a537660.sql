REVOKE EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_blocked_between(uuid, uuid) TO authenticated;