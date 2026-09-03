REVOKE ALL ON FUNCTION public.grant_admin_for_allowlisted_email() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_platform_admin(uuid) FROM PUBLIC, anon;