REVOKE EXECUTE ON FUNCTION public.create_team(text, text, text, text, text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.link_guardian(uuid, uuid, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.link_guardian(uuid, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.find_team_by_code(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.find_team_by_code(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_team_join_codes() FROM anon, authenticated, public;
