CREATE OR REPLACE FUNCTION public.preview_team_by_code(_code text)
RETURNS TABLE(name text, club_name text, age_group text, join_role text, guardian_only boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.name,
         c.name,
         t.age_group,
         CASE WHEN upper(trim(_code)) = t.coach_join_code THEN 'coach' ELSE 'player' END,
         public.team_guardian_only(t.id)
  FROM public.teams t
  LEFT JOIN public.clubs c ON c.id = t.club_id
  WHERE t.archived_at IS NULL
    AND upper(trim(_code)) IN (t.join_code, t.coach_join_code)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.preview_team_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_team_by_code(text) TO anon, authenticated;