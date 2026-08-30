REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_team_coach(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_coach(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
