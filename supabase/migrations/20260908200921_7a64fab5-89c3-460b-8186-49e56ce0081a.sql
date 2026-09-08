REVOKE ALL ON FUNCTION public.invite_recipient_users(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invite_recipient_users(uuid, uuid) TO service_role;