ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS guardian_only boolean;

COMMENT ON COLUMN public.teams.guardian_only IS 'NULL = härled från åldersgrupp (under 12 år = bara vårdnadshavare).';

CREATE OR REPLACE FUNCTION public.team_guardian_only(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN t.guardian_only IS NOT NULL THEN t.guardian_only
    WHEN (substring(coalesce(t.age_group, '') from '(19|20)[0-9]{2}')) IS NOT NULL
      THEN (extract(year from now())::int
            - (substring(t.age_group from '(?:19|20)[0-9]{2}'))::int) < 12
    ELSE false
  END
  FROM public.teams t
  WHERE t.id = _team_id;
$$;

GRANT EXECUTE ON FUNCTION public.team_guardian_only(uuid) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.join_team_with_code(_code text, _account_kind text)
RETURNS TABLE(team_id uuid, team_name text, member_role text, member_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  norm text := upper(btrim(COALESCE(_code, '')));
  t public.teams;
  code_kind text;
  expected_kind text;
  existing public.team_members;
  wanted text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  IF _account_kind IS NULL OR _account_kind NOT IN ('coach', 'player', 'guardian') THEN
    RAISE EXCEPTION 'Ogiltig kontotyp.';
  END IF;

  IF norm !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'Koden ska vara exakt sex tecken (A-Z, 0-9).';
  END IF;

  SELECT * INTO t FROM public.teams
  WHERE join_code = norm OR coach_join_code = norm
  LIMIT 1;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Koden stämmer inte. Kontrollera de sex tecknen med din tränare.';
  END IF;

  IF t.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Laget är arkiverat. Be din tränare om en ny kod.';
  END IF;

  code_kind := CASE WHEN t.coach_join_code = norm THEN 'coach' ELSE 'player' END;
  expected_kind := CASE WHEN _account_kind = 'coach' THEN 'coach' ELSE 'player' END;

  IF code_kind <> expected_kind THEN
    IF expected_kind = 'coach' THEN
      RAISE EXCEPTION 'Den koden är en spelarkod. Som tränare behöver du lagets tränarkod.';
    ELSE
      RAISE EXCEPTION 'Den koden är en tränarkod. Som spelare eller vårdnadshavare behöver du lagets spelarkod.';
    END IF;
  END IF;

  wanted := _account_kind;
  IF wanted = 'player' AND public.team_guardian_only(t.id) THEN
    wanted := 'guardian';
  END IF;

  SELECT * INTO existing FROM public.team_members m
  WHERE m.team_id = t.id AND m.user_id = uid;

  IF existing.id IS NOT NULL THEN
    RETURN QUERY SELECT t.id, t.name, existing.role, existing.status;
    RETURN;
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role, status, joined_via)
  VALUES (t.id, uid, wanted, 'pending',
          CASE WHEN code_kind = 'coach' THEN 'coach_code' ELSE 'player_code' END);

  RETURN QUERY SELECT t.id, t.name, wanted, 'pending'::text;
END;
$$;

DROP FUNCTION IF EXISTS public.find_team_by_code(text);

CREATE FUNCTION public.find_team_by_code(_code text)
RETURNS TABLE(id uuid, name text, age_group text, club_name text, join_role text, guardian_only boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id,
         t.name,
         t.age_group,
         c.name,
         CASE WHEN t.coach_join_code = upper(btrim(coalesce(_code, ''))) THEN 'coach' ELSE 'player' END,
         public.team_guardian_only(t.id)
  FROM public.teams t
  LEFT JOIN public.clubs c ON c.id = t.club_id
  WHERE upper(btrim(coalesce(_code, ''))) ~ '^[A-Z0-9]{6}$'
    AND t.archived_at IS NULL
    AND (t.join_code = upper(btrim(_code)) OR t.coach_join_code = upper(btrim(_code)))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_team_by_code(text) TO authenticated, anon, service_role;