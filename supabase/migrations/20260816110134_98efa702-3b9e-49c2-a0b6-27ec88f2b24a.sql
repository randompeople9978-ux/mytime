REVOKE ALL ON FUNCTION public.generate_username(text, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.generate_username(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.generate_username(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_username(text, uuid) TO service_role;
