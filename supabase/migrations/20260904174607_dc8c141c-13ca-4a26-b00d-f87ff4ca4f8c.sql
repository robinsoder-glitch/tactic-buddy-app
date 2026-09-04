-- Koderna får inte längre läsas eller ändras via de vanliga lagfrågorna
REVOKE SELECT, UPDATE ON public.teams FROM anon, authenticated;

GRANT SELECT (
  id, club_id, name, age_group, gender, photo_path, about,
  created_by, created_at, updated_at, home_ground, archived_at, game_format
) ON public.teams TO anon, authenticated;

GRANT UPDATE (
  club_id, name, age_group, gender, photo_path, about,
  home_ground, archived_at, game_format, updated_at
) ON public.teams TO authenticated;

GRANT SELECT, UPDATE ON public.teams TO service_role;

-- Skyddad läsning av lagets koder
CREATE OR REPLACE FUNCTION public.get_team_codes(_team_id uuid)
RETURNS TABLE(join_code text, coach_join_code text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;
  IF NOT public.is_team_coach(_team_id, uid) AND NOT public.is_platform_admin(uid) THEN
    RAISE EXCEPTION 'Endast lagets tränare kan se lagets koder.';
  END IF;

  RETURN QUERY
  SELECT t.join_code, t.coach_join_code
  FROM public.teams t
  WHERE t.id = _team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_team_codes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_codes(uuid) TO authenticated, service_role;

-- Tränarkoderna kan ha varit läsbara: byt ut dem en gång
UPDATE public.teams SET coach_join_code = public.gen_team_code();