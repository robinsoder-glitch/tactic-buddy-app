REVOKE EXECUTE ON FUNCTION public.can_manage_attendance(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_see_member_profile(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_event_change(uuid, jsonb, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_team_with_code(text, text) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_manage_attendance(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_member_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_event_change(uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_team_with_code(text, text) TO authenticated;