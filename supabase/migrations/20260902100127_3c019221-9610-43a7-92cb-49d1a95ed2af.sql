ALTER TABLE public.teams ALTER COLUMN coach_join_code SET DEFAULT public.gen_team_code();

REVOKE ALL ON FUNCTION public.gen_team_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_team_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_team_by_code(text) TO authenticated;
REVOKE ALL ON FUNCTION public.join_team_with_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_team_with_code(text) TO authenticated;
REVOKE ALL ON FUNCTION public.rotate_team_code(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotate_team_code(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.set_team_codes() FROM PUBLIC, anon, authenticated;