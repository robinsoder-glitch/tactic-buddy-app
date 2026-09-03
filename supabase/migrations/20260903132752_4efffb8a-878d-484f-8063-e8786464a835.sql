-- 1. Nytt visningsnamn: aldrig e-postadressen
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, guardian_for_name)
  VALUES (
    NEW.id,
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'display_name', '')), ''),
    NULLIF(btrim(COALESCE(NEW.raw_user_meta_data->>'player_name', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- 2. Kodsökning: bara exakt sex tecken
CREATE OR REPLACE FUNCTION public.find_team_by_code(_code text)
 RETURNS TABLE(id uuid, name text, age_group text, club_name text, join_role text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT t.id, t.name, t.age_group, c.name,
         CASE WHEN t.coach_join_code = upper(btrim(_code)) THEN 'coach' ELSE 'player' END
  FROM public.teams t
  LEFT JOIN public.clubs c ON c.id = t.club_id
  WHERE t.archived_at IS NULL
    AND length(upper(btrim(_code))) = 6
    AND (t.join_code = upper(btrim(_code)) OR t.coach_join_code = upper(btrim(_code)))
$function$;

-- 3. Anslutning kontrollerar kodtyp mot kontotyp
DROP FUNCTION IF EXISTS public.join_team_with_code(text);

CREATE OR REPLACE FUNCTION public.join_team_with_code(_code text, _account_kind text)
 RETURNS TABLE(team_id uuid, team_name text, member_role text, member_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  norm text := upper(btrim(COALESCE(_code, '')));
  t public.teams;
  code_kind text;
  expected_kind text;
  existing public.team_members;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  IF _account_kind IS NULL OR _account_kind NOT IN ('coach', 'player', 'guardian') THEN
    RAISE EXCEPTION 'Ogiltig kontotyp.';
  END IF;

  IF length(norm) <> 6 THEN
    RAISE EXCEPTION 'Lagkoden ska vara exakt sex tecken.';
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

  SELECT * INTO existing FROM public.team_members m
  WHERE m.team_id = t.id AND m.user_id = uid;

  IF existing.id IS NOT NULL THEN
    RETURN QUERY SELECT t.id, t.name, existing.role, existing.status;
    RETURN;
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role, status)
  VALUES (t.id, uid, _account_kind, 'pending');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, (CASE WHEN _account_kind = 'coach' THEN 'coach' ELSE 'player' END)::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT t.id, t.name, _account_kind, 'pending'::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.join_team_with_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_team_with_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_team_with_code(text, text) TO service_role;