-- 1. Koder normaliseras och valideras vid både insert och update
CREATE OR REPLACE FUNCTION public.set_team_codes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.join_code := upper(btrim(COALESCE(NEW.join_code, '')));
  NEW.coach_join_code := upper(btrim(COALESCE(NEW.coach_join_code, '')));

  IF NEW.join_code = '' THEN
    NEW.join_code := public.gen_team_code();
  END IF;
  IF NEW.coach_join_code = '' THEN
    NEW.coach_join_code := public.gen_team_code();
  END IF;

  IF NEW.join_code !~ '^[A-Z0-9]{6}$' OR NEW.coach_join_code !~ '^[A-Z0-9]{6}$' THEN
    RAISE EXCEPTION 'Lagkoder måste vara exakt sex tecken (A-Z, 0-9).';
  END IF;

  IF NEW.join_code = NEW.coach_join_code THEN
    RAISE EXCEPTION 'Spelarkod och tränarkod måste vara olika.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id <> NEW.id
      AND (t.join_code IN (NEW.join_code, NEW.coach_join_code)
        OR t.coach_join_code IN (NEW.join_code, NEW.coach_join_code))
  ) THEN
    RAISE EXCEPTION 'Koden används redan av ett annat lag.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS teams_set_codes ON public.teams;
CREATE TRIGGER teams_set_codes
BEFORE INSERT OR UPDATE OF join_code, coach_join_code ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_team_codes();

REVOKE ALL ON FUNCTION public.set_team_codes() FROM PUBLIC, anon, authenticated;

-- 2. Kodsökning ger alltid exakt ett lag, tränarkoden vinner
CREATE OR REPLACE FUNCTION public.find_team_by_code(_code text)
RETURNS TABLE(id uuid, name text, age_group text, club_name text, join_role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT t.id, t.name, t.age_group, c.name,
         CASE WHEN t.coach_join_code = upper(btrim(_code)) THEN 'coach' ELSE 'player' END
  FROM public.teams t
  LEFT JOIN public.clubs c ON c.id = t.club_id
  WHERE t.archived_at IS NULL
    AND upper(btrim(_code)) ~ '^[A-Z0-9]{6}$'
    AND (t.join_code = upper(btrim(_code)) OR t.coach_join_code = upper(btrim(_code)))
  ORDER BY (t.coach_join_code = upper(btrim(_code))) DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.find_team_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_team_by_code(text) TO anon, authenticated, service_role;