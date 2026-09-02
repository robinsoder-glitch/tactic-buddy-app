REVOKE ALL ON FUNCTION public.is_guardian_of(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_guardian_of(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.player_team(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.player_team(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.team_role(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.team_role(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.send_invite_reminders(uuid, text, text) FROM anon;