REVOKE ALL ON FUNCTION public.copy_coach_session(uuid, text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_coach_session(uuid, text, uuid, boolean) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.start_session_run(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_session_run(uuid, uuid) TO authenticated, service_role;