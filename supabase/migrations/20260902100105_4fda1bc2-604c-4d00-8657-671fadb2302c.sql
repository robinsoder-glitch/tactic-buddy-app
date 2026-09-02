-- Helper: generate a unique 6-char join code
CREATE OR REPLACE FUNCTION public.gen_team_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.join_code = candidate OR t.coach_join_code = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$$;

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS coach_join_code text;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.teams WHERE coach_join_code IS NULL LOOP
    UPDATE public.teams SET coach_join_code = public.gen_team_code() WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.teams ALTER COLUMN coach_join_code SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS teams_coach_join_code_key ON public.teams (coach_join_code);

CREATE OR REPLACE FUNCTION public.set_team_codes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.join_code IS NULL OR btrim(NEW.join_code) = '' THEN
    NEW.join_code := public.gen_team_code();
  END IF;
  IF NEW.coach_join_code IS NULL OR btrim(NEW.coach_join_code) = '' THEN
    NEW.coach_join_code := public.gen_team_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teams_set_codes ON public.teams;
CREATE TRIGGER teams_set_codes BEFORE INSERT ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_team_codes();

-- Guardian support on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_for_name text;

-- Lookup a team by either code, returning which role the code grants
DROP FUNCTION IF EXISTS public.find_team_by_code(text);
CREATE OR REPLACE FUNCTION public.find_team_by_code(_code text)
RETURNS TABLE(id uuid, name text, age_group text, club_name text, join_role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.name, t.age_group, c.name,
         CASE WHEN t.coach_join_code = upper(btrim(_code)) THEN 'coach' ELSE 'player' END
  FROM public.teams t
  LEFT JOIN public.clubs c ON c.id = t.club_id
  WHERE t.archived_at IS NULL
    AND (t.join_code = upper(btrim(_code)) OR t.coach_join_code = upper(btrim(_code)))
$$;

-- Join a team with a code, atomically
CREATE OR REPLACE FUNCTION public.join_team_with_code(_code text)
RETURNS TABLE(team_id uuid, team_name text, member_role text, member_status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.teams;
  wanted_role text;
  existing public.team_members;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT * INTO t FROM public.teams
  WHERE archived_at IS NULL
    AND (join_code = upper(btrim(_code)) OR coach_join_code = upper(btrim(_code)))
  LIMIT 1;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Ingen lag hittades med den koden.';
  END IF;

  wanted_role := CASE WHEN t.coach_join_code = upper(btrim(_code)) THEN 'coach' ELSE 'player' END;

  SELECT * INTO existing FROM public.team_members m
  WHERE m.team_id = t.id AND m.user_id = uid;

  IF existing.id IS NOT NULL THEN
    RETURN QUERY SELECT t.id, t.name, existing.role, existing.status;
    RETURN;
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role, status)
  VALUES (t.id, uid, wanted_role, 'pending');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, wanted_role::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT t.id, t.name, wanted_role, 'pending'::text;
END;
$$;

-- Rotate a team code (coaches only)
CREATE OR REPLACE FUNCTION public.rotate_team_code(_team_id uuid, _kind text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  fresh text;
BEGIN
  IF uid IS NULL OR NOT public.is_team_coach(_team_id, uid) THEN
    RAISE EXCEPTION 'Endast lagets tränare kan skapa en ny kod.';
  END IF;
  IF _kind NOT IN ('player', 'coach') THEN
    RAISE EXCEPTION 'Ogiltig kodtyp.';
  END IF;

  fresh := public.gen_team_code();
  IF _kind = 'coach' THEN
    UPDATE public.teams SET coach_join_code = fresh WHERE id = _team_id;
  ELSE
    UPDATE public.teams SET join_code = fresh WHERE id = _team_id;
  END IF;
  RETURN fresh;
END;
$$;