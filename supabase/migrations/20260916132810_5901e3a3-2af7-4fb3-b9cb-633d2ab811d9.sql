CREATE OR REPLACE FUNCTION public.create_team(_name text, _age_group text DEFAULT NULL::text, _game_format text DEFAULT NULL::text, _gender text DEFAULT 'mixed'::text, _home_ground text DEFAULT NULL::text, _club_id uuid DEFAULT NULL::uuid, _club_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  club uuid := _club_id;
  new_team uuid;
  kind text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT account_kind INTO kind FROM public.profiles WHERE id = uid;
  IF kind IN ('player', 'guardian') THEN
    RAISE EXCEPTION 'Bara tränarkonton kan skapa lag.';
  END IF;

  IF NULLIF(btrim(COALESCE(_name, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Laget behöver ett namn.';
  END IF;
  IF COALESCE(_gender, '') NOT IN ('boys', 'girls', 'mixed') THEN
    RAISE EXCEPTION 'Ogiltigt val för lagtyp.';
  END IF;

  IF club IS NULL AND NULLIF(btrim(COALESCE(_club_name, '')), '') IS NOT NULL THEN
    INSERT INTO public.clubs (name, created_by)
    VALUES (btrim(_club_name), uid)
    RETURNING id INTO club;
  END IF;

  INSERT INTO public.teams (created_by, club_id, name, age_group, game_format, gender, home_ground)
  VALUES (uid, club, btrim(_name), NULLIF(btrim(COALESCE(_age_group, '')), ''),
          NULLIF(btrim(COALESCE(_game_format, '')), ''), _gender,
          NULLIF(btrim(COALESCE(_home_ground, '')), ''))
  RETURNING id INTO new_team;

  INSERT INTO public.team_members (team_id, user_id, role, status, joined_via)
  VALUES (new_team, uid, 'head_coach', 'approved', 'created_team');

  RETURN new_team;
END;
$function$;