-- Återställ läsrättigheter på lagtabellen för inloggade användare.
-- Kolumngrants används i stället för tabellgrant så att anslutningskoderna
-- (join_code, coach_join_code) förblir otillgängliga via Data API.
GRANT SELECT (
  id, club_id, name, age_group, gender, photo_path, about,
  created_by, created_at, updated_at, home_ground, archived_at, game_format
) ON public.teams TO authenticated;

GRANT UPDATE (
  club_id, name, age_group, gender, photo_path, about, created_by,
  updated_at, home_ground, archived_at, game_format
) ON public.teams TO authenticated;

GRANT DELETE ON public.teams TO authenticated;

GRANT INSERT (
  id, club_id, name, age_group, gender, photo_path, about, created_by,
  created_at, updated_at, home_ground, archived_at, game_format
) ON public.teams TO authenticated;

GRANT ALL ON public.teams TO service_role;

REVOKE ALL ON public.teams FROM anon;