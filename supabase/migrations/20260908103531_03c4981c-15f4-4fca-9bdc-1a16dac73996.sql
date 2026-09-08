-- 1. Skyddad kodtabell -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_join_codes (
  code text PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('player', 'coach')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  UNIQUE (team_id, kind)
);

GRANT ALL ON public.team_join_codes TO service_role;
ALTER TABLE public.team_join_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform admin reads join codes" ON public.team_join_codes;
CREATE POLICY "Platform admin reads join codes" ON public.team_join_codes
  FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

-- Backfill från befintliga kolumner (datatbevarande, idempotent).
INSERT INTO public.team_join_codes (code, team_id, kind, created_at)
SELECT t.join_code, t.id, 'player', t.created_at FROM public.teams t
WHERE t.join_code ~ '^[A-Z0-9]{6}$'
ON CONFLICT DO NOTHING;

INSERT INTO public.team_join_codes (code, team_id, kind, created_at)
SELECT t.coach_join_code, t.id, 'coach', t.created_at FROM public.teams t
WHERE t.coach_join_code ~ '^[A-Z0-9]{6}$'
ON CONFLICT DO NOTHING;

-- 2. Kodgenerering utan kollisionsrisk ---------------------------------------
CREATE OR REPLACE FUNCTION public.gen_team_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  candidate text;
BEGIN
  -- Serialiserar all kodgenerering inom transaktionen så att två samtidiga
  -- lag aldrig kan få samma sexteckenkod, oavsett kodtyp.
  PERFORM pg_advisory_xact_lock(hashtext('public.team_join_codes'));
  LOOP
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.team_join_codes c WHERE c.code = candidate)
      AND NOT EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.join_code = candidate OR t.coach_join_code = candidate
      );
  END LOOP;
  RETURN candidate;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_team_join_codes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.team_join_codes (code, team_id, kind, created_by)
  VALUES (NEW.join_code, NEW.id, 'player', NEW.created_by)
  ON CONFLICT (team_id, kind) DO UPDATE
    SET code = EXCLUDED.code, rotated_at = now();

  INSERT INTO public.team_join_codes (code, team_id, kind, created_by)
  VALUES (NEW.coach_join_code, NEW.id, 'coach', NEW.created_by)
  ON CONFLICT (team_id, kind) DO UPDATE
    SET code = EXCLUDED.code, rotated_at = now();

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_team_join_codes ON public.teams;
CREATE TRIGGER sync_team_join_codes
AFTER INSERT OR UPDATE OF join_code, coach_join_code ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.sync_team_join_codes();

-- 3. Koderna får aldrig lämna Data API ---------------------------------------
REVOKE SELECT ON public.teams FROM anon, authenticated;
GRANT SELECT (
  id, club_id, name, age_group, gender, photo_path, about, created_by,
  created_at, updated_at, home_ground, archived_at, game_format
) ON public.teams TO authenticated;

-- 4. Ingen självbefordran ----------------------------------------------------
DROP POLICY IF EXISTS "self assign coach or player" ON public.user_roles;
REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;

DROP POLICY IF EXISTS "coaches create teams" ON public.teams;
CREATE POLICY "members create own teams" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "coaches create clubs" ON public.clubs;
CREATE POLICY "members create own clubs" ON public.clubs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "join or coach adds member" ON public.team_members;
CREATE POLICY "join or coach adds member" ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    ((user_id = auth.uid()) AND (role = 'player') AND (status = 'pending'))
    OR ((user_id = auth.uid()) AND (role IN ('coach', 'head_coach'))
        AND (status = 'approved')
        AND EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND t.created_by = auth.uid()))
    OR public.is_team_coach(team_id, auth.uid())
  );

-- Träningsbankens innehåll: alla inloggade, inte den självsatta coach-rollen.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('tb_rulesets','tb_district_profiles','tb_formations','tb_taxonomy',
                        'tb_tactics','tb_goalkeeper_cards','tb_drills','tb_training_sessions')
      AND coalesce(qual::text, '') LIKE '%coach''::app_role%'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    EXECUTE format(
      'CREATE POLICY "signed in read" ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)',
      r.tablename);
  END LOOP;
END $$;

-- Anslutning med kod ger inte längre någon global roll.
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

  SELECT * INTO existing FROM public.team_members m
  WHERE m.team_id = t.id AND m.user_id = uid;

  IF existing.id IS NOT NULL THEN
    RETURN QUERY SELECT t.id, t.name, existing.role, existing.status;
    RETURN;
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role, status, joined_via)
  VALUES (t.id, uid, _account_kind, 'pending',
          CASE WHEN code_kind = 'coach' THEN 'coach_code' ELSE 'player_code' END);

  RETURN QUERY SELECT t.id, t.name, _account_kind, 'pending'::text;
END;
$function$;

-- 5. Skapa lag atomärt --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_team(
  _name text,
  _age_group text DEFAULT NULL,
  _game_format text DEFAULT NULL,
  _gender text DEFAULT 'mixed',
  _home_ground text DEFAULT NULL,
  _club_id uuid DEFAULT NULL,
  _club_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  club uuid := _club_id;
  new_team uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
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

REVOKE ALL ON FUNCTION public.create_team(text, text, text, text, text, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_team(text, text, text, text, text, uuid, text) TO authenticated;
