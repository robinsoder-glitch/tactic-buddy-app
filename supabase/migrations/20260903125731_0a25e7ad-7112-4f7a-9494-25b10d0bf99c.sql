-- 1. Kolumnnivå-behörighet: ta bort bred läsrätt och ge bara ofarliga fält
REVOKE SELECT ON public.players FROM authenticated;
REVOKE SELECT ON public.players FROM anon;

GRANT SELECT (
  id, user_id, team_id, team, name, number, photo_path,
  is_goalkeeper, is_active, member_user_id, gender, created_at, updated_at
) ON public.players TO authenticated;

GRANT ALL ON public.players TO service_role;

-- 2. Skyddat uppslag för en spelare
CREATE OR REPLACE FUNCTION public.get_player_private(_player_id uuid)
RETURNS TABLE(
  player_id uuid,
  birth_date date,
  guardian1_name text,
  guardian1_phone text,
  guardian1_email text,
  guardian2_name text,
  guardian2_phone text,
  guardian2_email text,
  has_allergy boolean,
  allergy_note text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.birth_date,
         p.guardian1_name, p.guardian1_phone, p.guardian1_email,
         p.guardian2_name, p.guardian2_phone, p.guardian2_email,
         p.has_allergy, p.allergy_note
  FROM public.players p
  WHERE p.id = _player_id
    AND auth.uid() IS NOT NULL
    AND (
      public.is_team_coach(p.team_id, auth.uid())
      OR public.is_platform_admin(auth.uid())
      OR public.is_guardian_of(p.id)
      OR p.member_user_id = auth.uid()
    )
$$;

REVOKE ALL ON FUNCTION public.get_player_private(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_player_private(uuid) TO authenticated;

-- 3. Skyddat uppslag för hela truppen (ledare/admin ser alla, vårdnadshavare bara sina barn)
CREATE OR REPLACE FUNCTION public.get_team_players_private(_team_id uuid)
RETURNS TABLE(
  player_id uuid,
  birth_date date,
  guardian1_name text,
  guardian1_phone text,
  guardian1_email text,
  guardian2_name text,
  guardian2_phone text,
  guardian2_email text,
  has_allergy boolean,
  allergy_note text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT p.id, p.birth_date,
         p.guardian1_name, p.guardian1_phone, p.guardian1_email,
         p.guardian2_name, p.guardian2_phone, p.guardian2_email,
         p.has_allergy, p.allergy_note
  FROM public.players p
  WHERE p.team_id = _team_id
    AND auth.uid() IS NOT NULL
    AND (
      public.is_team_coach(_team_id, auth.uid())
      OR public.is_platform_admin(auth.uid())
      OR public.is_guardian_of(p.id)
      OR p.member_user_id = auth.uid()
    )
$$;

REVOKE ALL ON FUNCTION public.get_team_players_private(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_players_private(uuid) TO authenticated;