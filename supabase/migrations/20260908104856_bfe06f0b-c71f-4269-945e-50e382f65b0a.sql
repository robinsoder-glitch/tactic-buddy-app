CREATE OR REPLACE FUNCTION public.save_match_plan(
  _event_id uuid,
  _team_id uuid,
  _notes text,
  _player_ids uuid[],
  _coach_ids uuid[],
  _formation text,
  _slots jsonb,
  _bench uuid[],
  _tactic_id uuid,
  _required integer,
  _update_event boolean DEFAULT false,
  _location text DEFAULT NULL,
  _starts_at timestamptz DEFAULT NULL,
  _ends_at timestamptz DEFAULT NULL,
  _meet_at timestamptz DEFAULT NULL,
  _home_team text DEFAULT NULL,
  _away_team text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  starter_ids uuid[];
  all_ids uuid[];
  n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  IF NOT public.is_team_coach(_team_id, uid) THEN RAISE EXCEPTION 'Endast lagets tränare kan spara planeringen.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND team_id = _team_id) THEN
    RAISE EXCEPTION 'Matchen hittades inte i laget.'; END IF;
  IF _player_ids IS NULL OR array_length(_player_ids, 1) IS NULL THEN RAISE EXCEPTION 'Välj minst en spelare.'; END IF;
  IF _coach_ids IS NULL OR array_length(_coach_ids, 1) IS NULL THEN RAISE EXCEPTION 'Välj minst en ledare.'; END IF;
  IF (SELECT count(*) FROM (SELECT unnest(_player_ids) AS p) q JOIN public.players pl ON pl.id = q.p WHERE pl.team_id = _team_id)
     <> array_length(_player_ids, 1) THEN RAISE EXCEPTION 'Alla spelare måste tillhöra laget.'; END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(_coach_ids) cid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.team_members m
      WHERE m.team_id = _team_id AND m.user_id = cid
        AND m.status = 'approved' AND m.role IN ('coach', 'head_coach', 'club_admin')
    )
  ) THEN
    RAISE EXCEPTION 'Alla valda ledare måste vara godkända ledare i laget.';
  END IF;

  SELECT array_agg(DISTINCT (s->>'player_id')::uuid) INTO starter_ids
  FROM jsonb_array_elements(COALESCE(_slots, '[]'::jsonb)) s
  WHERE NULLIF(s->>'player_id', '') IS NOT NULL;
  starter_ids := COALESCE(starter_ids, '{}');

  SELECT count(*) INTO n FROM jsonb_array_elements(COALESCE(_slots, '[]'::jsonb)) s
  WHERE NULLIF(s->>'player_id', '') IS NOT NULL;
  IF n <> array_length(starter_ids, 1) THEN RAISE EXCEPTION 'Samma spelare kan bara stå på en planposition.'; END IF;

  IF _required IS NOT NULL AND _required > 0 AND n <> _required THEN
    RAISE EXCEPTION 'Det måste vara exakt % startspelare för vald spelform (nu %).', _required, n; END IF;

  all_ids := starter_ids || COALESCE(_bench, '{}');
  IF (SELECT count(*) FROM unnest(all_ids) a) <> (SELECT count(DISTINCT a) FROM unnest(all_ids) a) THEN
    RAISE EXCEPTION 'En avbytare kan inte samtidigt stå på planen.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(all_ids) a WHERE NOT (a = ANY(_player_ids))) THEN
    RAISE EXCEPTION 'Alla spelare på planen och bänken måste ingå i uttagningen.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(_slots, '[]'::jsonb)) s
             WHERE (s->>'x')::float < 0 OR (s->>'x')::float > 1 OR (s->>'y')::float < 0 OR (s->>'y')::float > 1) THEN
    RAISE EXCEPTION 'Alla planpositioner måste ligga innanför planen.'; END IF;

  IF _update_event THEN
    IF _starts_at IS NULL THEN RAISE EXCEPTION 'Matchen måste ha en starttid.'; END IF;
    IF _ends_at IS NOT NULL AND _ends_at <= _starts_at THEN
      RAISE EXCEPTION 'Sluttiden måste vara efter starttiden.'; END IF;
    IF _meet_at IS NOT NULL AND _meet_at > _starts_at THEN
      RAISE EXCEPTION 'Samlingstiden måste vara före matchstarten.'; END IF;

    UPDATE public.events
    SET location = NULLIF(btrim(COALESCE(_location, '')), ''),
        starts_at = _starts_at,
        ends_at = _ends_at,
        meet_at = _meet_at,
        home_team = NULLIF(btrim(COALESCE(_home_team, '')), ''),
        away_team = NULLIF(btrim(COALESCE(_away_team, '')), '')
    WHERE id = _event_id AND team_id = _team_id;
  END IF;

  DELETE FROM public.event_squad WHERE event_id = _event_id;
  INSERT INTO public.event_squad (event_id, team_id, player_id, created_by)
  SELECT _event_id, _team_id, pid, uid FROM unnest(_player_ids) AS pid;

  DELETE FROM public.event_coaches WHERE event_id = _event_id;
  INSERT INTO public.event_coaches (event_id, team_id, user_id, created_by)
  SELECT DISTINCT _event_id, _team_id, cid, uid FROM unnest(_coach_ids) AS cid;

  INSERT INTO public.event_plans (event_id, team_id, created_by, notes, planning_done)
  VALUES (_event_id, _team_id, uid, NULLIF(btrim(COALESCE(_notes, '')), ''), true)
  ON CONFLICT (event_id) DO UPDATE SET notes = EXCLUDED.notes, planning_done = true;

  INSERT INTO public.match_lineups (event_id, team_id, formation, slots, bench, tactic_id, created_by)
  VALUES (_event_id, _team_id, _formation, COALESCE(_slots, '[]'::jsonb), to_jsonb(COALESCE(_bench, '{}')), _tactic_id, uid)
  ON CONFLICT (event_id) DO UPDATE SET formation = EXCLUDED.formation, slots = EXCLUDED.slots,
    bench = EXCLUDED.bench, tactic_id = EXCLUDED.tactic_id;
END;
$function$;

DROP FUNCTION IF EXISTS public.save_match_plan(uuid, uuid, text, uuid[], uuid[], text, jsonb, uuid[], uuid, integer);