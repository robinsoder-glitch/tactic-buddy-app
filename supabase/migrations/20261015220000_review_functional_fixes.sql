BEGIN;

-- Ägarbyte kontrolleras även vid direkt tabellåtkomst.
CREATE OR REPLACE FUNCTION public.guard_team_ownership()
RETURNS trigger LANGUAGE plpgsql SET search_path TO public AS $fn$
DECLARE uid uuid := auth.uid();
BEGIN
  IF NEW.created_by IS NOT DISTINCT FROM OLD.created_by THEN RETURN NEW; END IF;
  -- Betrodd databasadministration utan användarsession måste kunna underhålla data.
  IF uid IS NULL AND current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;
  IF uid IS NULL OR (uid IS DISTINCT FROM OLD.created_by
      AND NOT public.is_platform_admin(uid)) THEN
    RAISE EXCEPTION 'Bara lagets ägare kan överlåta laget.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_team_coach(OLD.id, NEW.created_by) THEN
    RAISE EXCEPTION 'Den nya ägaren måste vara en godkänd ledare i laget.';
  END IF;
  RETURN NEW;
END;
$fn$;
DROP TRIGGER IF EXISTS teams_guard_ownership ON public.teams;
CREATE TRIGGER teams_guard_ownership BEFORE UPDATE OF created_by ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.guard_team_ownership();

CREATE OR REPLACE FUNCTION public.transfer_team_ownership(_team_id uuid, _new_owner_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
DECLARE uid uuid := auth.uid(); owner_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  SELECT created_by INTO owner_id FROM public.teams WHERE id = _team_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Laget hittades inte.'; END IF;
  IF uid IS DISTINCT FROM owner_id AND NOT public.is_platform_admin(uid) THEN
    RAISE EXCEPTION 'Bara lagets ägare kan överlåta laget.' USING ERRCODE = '42501';
  END IF;
  IF _new_owner_id IS NULL OR NOT public.is_team_coach(_team_id, _new_owner_id) THEN
    RAISE EXCEPTION 'Den nya ägaren måste vara en godkänd ledare i laget.';
  END IF;
  UPDATE public.teams SET created_by = _new_owner_id WHERE id = _team_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.transfer_team_ownership(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_team_ownership(uuid, uuid) TO authenticated, service_role;

-- Skaparen bevaras vid redigering; en annan godkänd ledare får också spara.
DROP POLICY IF EXISTS "coaches manage event plans" ON public.event_plans;
DROP POLICY IF EXISTS "coaches create event plans" ON public.event_plans;
DROP POLICY IF EXISTS "coaches update event plans" ON public.event_plans;
DROP POLICY IF EXISTS "coaches delete event plans" ON public.event_plans;
CREATE POLICY "coaches create event plans" ON public.event_plans FOR INSERT TO authenticated
  WITH CHECK (public.is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "coaches update event plans" ON public.event_plans FOR UPDATE TO authenticated
  USING (public.is_team_coach(team_id, auth.uid()))
  WITH CHECK (public.is_team_coach(team_id, auth.uid()));
CREATE POLICY "coaches delete event plans" ON public.event_plans FOR DELETE TO authenticated
  USING (public.is_team_coach(team_id, auth.uid()));

-- Samma atomiska sparväg används av aktivitetsdialogen och matchplaneringen.
CREATE OR REPLACE FUNCTION public.save_event_details(
  _event_id uuid, _starts_at timestamptz, _ends_at timestamptz,
  _meet_at timestamptz, _location text
)
RETURNS void LANGUAGE plpgsql SET search_path TO public AS $fn$
DECLARE
  uid uuid := auth.uid();
  ev public.events;
  change_row record;
  changes jsonb := '[]'::jsonb;
  notice text := '';
  old_display text;
  new_display text;
  cleaned_location text := NULLIF(btrim(COALESCE(_location, '')), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  SELECT * INTO ev FROM public.events WHERE id = _event_id FOR UPDATE;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'Aktiviteten hittades inte.'; END IF;
  IF NOT public.is_team_coach(ev.team_id, uid) AND NOT public.is_platform_admin(uid) THEN
    RAISE EXCEPTION 'Endast lagets ledare kan ändra aktiviteten.' USING ERRCODE = '42501';
  END IF;
  IF _starts_at IS NULL THEN RAISE EXCEPTION 'Aktiviteten måste ha en starttid.'; END IF;
  IF _ends_at IS NOT NULL AND _ends_at <= _starts_at THEN
    RAISE EXCEPTION 'Sluttiden måste vara efter starttiden.';
  END IF;
  IF _meet_at IS NOT NULL AND _meet_at > _starts_at THEN
    RAISE EXCEPTION 'Samlingstiden måste vara före starttiden.';
  END IF;

  FOR change_row IN
    SELECT * FROM (VALUES
      ('starts_at', 'Starttid', ev.starts_at::text, _starts_at::text, true),
      ('ends_at', 'Sluttid', ev.ends_at::text, _ends_at::text, true),
      ('meet_at', 'Samlingstid', ev.meet_at::text, _meet_at::text, true),
      ('location', 'Plats', ev.location, cleaned_location, false)
    ) AS v(field, label, old_value, new_value, is_time)
  LOOP
    IF change_row.old_value IS NOT DISTINCT FROM change_row.new_value THEN CONTINUE; END IF;
    old_display := CASE WHEN change_row.old_value IS NULL THEN 'Saknas'
      WHEN change_row.is_time THEN to_char(change_row.old_value::timestamptz AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD "kl." HH24:MI')
      ELSE change_row.old_value END;
    new_display := CASE WHEN change_row.new_value IS NULL THEN 'Saknas'
      WHEN change_row.is_time THEN to_char(change_row.new_value::timestamptz AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD "kl." HH24:MI')
      ELSE change_row.new_value END;
    changes := changes || jsonb_build_array(jsonb_build_object(
      'field', change_row.field, 'label', change_row.label, 'from', old_display, 'to', new_display));
    notice := notice || CASE WHEN notice = '' THEN '' ELSE ' ' END
      || change_row.label || ' har ändrats från ' || old_display || ' till ' || new_display || '.';
  END LOOP;
  IF jsonb_array_length(changes) = 0 THEN RETURN; END IF;

  UPDATE public.events SET starts_at = _starts_at, ends_at = _ends_at,
    meet_at = _meet_at, location = cleaned_location WHERE id = _event_id;
  PERFORM public.log_event_change(_event_id, changes, notice);
END;
$fn$;
REVOKE ALL ON FUNCTION public.save_event_details(uuid, timestamptz, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_event_details(uuid, timestamptz, timestamptz, timestamptz, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.save_match_plan(_event_id uuid, _team_id uuid, _notes text, _player_ids uuid[], _coach_ids uuid[], _formation text, _slots jsonb, _bench uuid[], _tactic_id uuid, _required integer, _update_event boolean DEFAULT false, _location text DEFAULT NULL::text, _starts_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _ends_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _meet_at timestamp with time zone DEFAULT NULL::timestamp with time zone, _home_team text DEFAULT NULL::text, _away_team text DEFAULT NULL::text)
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

    PERFORM public.save_event_details(_event_id, _starts_at, _ends_at, _meet_at, _location);
    UPDATE public.events
    SET home_team = NULLIF(btrim(COALESCE(_home_team, '')), ''),
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

CREATE OR REPLACE FUNCTION public.log_event_change(_event_id uuid, _changed_fields jsonb, _notice text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  log_id uuid;
BEGIN
  SELECT team_id INTO tid FROM public.events WHERE id = _event_id;
  IF tid IS NULL THEN
    RAISE EXCEPTION 'Aktiviteten hittades inte.';
  END IF;
  IF NOT public.is_team_coach(tid, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan ändra aktiviteten.';
  END IF;
  IF _changed_fields IS NULL OR jsonb_array_length(_changed_fields) = 0 THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('event_change:' || _event_id::text, 0));

  SELECT id INTO log_id
  FROM public.event_change_log
  WHERE event_id = _event_id
    AND changed_fields = _changed_fields
    AND created_at > now() - interval '2 minutes'
  LIMIT 1;

  IF log_id IS NOT NULL THEN
    RETURN log_id;
  END IF;

  INSERT INTO public.event_change_log (event_id, team_id, changed_by, changed_fields)
  VALUES (_event_id, tid, uid, _changed_fields)
  RETURNING id INTO log_id;

  IF _notice IS NOT NULL AND length(btrim(_notice)) > 0 THEN
    INSERT INTO public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by)
    SELECT DISTINCT u.user_id, tid, _event_id, 'event_changed', 'Aktiviteten har ändrats', _notice, uid
    FROM public.event_invitations i
    JOIN LATERAL (
      SELECT p.member_user_id AS user_id FROM public.players p WHERE p.id = i.player_id
      UNION
      SELECT g.guardian_user_id FROM public.player_guardians g
        WHERE g.player_id = i.player_id AND g.is_active
    ) u ON u.user_id IS NOT NULL
    WHERE i.event_id = _event_id
      AND i.status <> 'revoked'
      AND public.is_team_member(tid, u.user_id)
      AND NOT EXISTS (
        SELECT 1 FROM public.app_notifications n
        WHERE n.user_id = u.user_id
          AND n.event_id = _event_id
          AND n.kind = 'event_changed'
          AND n.body = _notice
          AND n.created_at > now() - interval '2 minutes'
      );
  END IF;

  RETURN log_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_training_plan_v2(_event_id uuid, _team_id uuid, _notes text, _focus_areas text[], _goal text, _items jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  IF NOT public.is_team_coach(_team_id, uid) THEN
    RAISE EXCEPTION 'Endast lagets tränare kan spara planeringen.';
  END IF;

  PERFORM 1 FROM public.events
    WHERE id = _event_id AND team_id = _team_id AND type = 'training'
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Träningen hittades inte i laget.'; END IF;

  DELETE FROM public.event_resources
  WHERE event_id = _event_id AND kind IN ('drill', 'goalkeeper', 'session');

  INSERT INTO public.event_resources
    (event_id, team_id, created_by, kind, resource_id, minutes, note, sort_order, details)
  SELECT _event_id, _team_id, uid,
         CASE WHEN COALESCE(item->>'kind', 'drill') IN ('drill', 'goalkeeper', 'session')
              THEN item->>'kind' ELSE 'drill' END,
         item->>'resource_id', NULLIF(item->>'minutes', '')::int,
         NULLIF(btrim(COALESCE(item->>'note', '')), ''), (ord - 1)::int,
         COALESCE(item->'details', '{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) WITH ORDINALITY AS t(item, ord);

  INSERT INTO public.event_plans
    (event_id, team_id, created_by, notes, focus_areas, goal, planning_done)
  VALUES
    (_event_id, _team_id, uid, NULLIF(btrim(COALESCE(_notes, '')), ''),
     COALESCE(_focus_areas, '{}'::text[]), NULLIF(btrim(COALESCE(_goal, '')), ''),
     jsonb_array_length(COALESCE(_items, '[]'::jsonb)) > 0
     AND cardinality(COALESCE(_focus_areas, '{}'::text[])) > 0
     AND NULLIF(btrim(COALESCE(_goal, '')), '') IS NOT NULL)
  ON CONFLICT (event_id) DO UPDATE
    SET notes = EXCLUDED.notes,
        focus_areas = EXCLUDED.focus_areas,
        goal = EXCLUDED.goal,
        planning_done = EXCLUDED.planning_done;
END;
$function$;

COMMIT;
