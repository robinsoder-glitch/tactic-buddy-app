-- Minimal modell för regressionstester. Inga riktiga konton eller produktionsrader.
-- Funktionsdefinitioner och radregler är baslinjen som granskades 2026-10-15.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $fn$
  SELECT nullif(current_setting('app.uid', true), '')::uuid
$fn$;
CREATE TYPE app_role AS ENUM ('admin','coach','player');
CREATE TABLE user_roles (user_id uuid, role app_role);
CREATE TABLE teams (id uuid PRIMARY KEY, name text, created_by uuid);
CREATE TABLE team_members (team_id uuid, user_id uuid, role text, status text);
CREATE TABLE events (id uuid PRIMARY KEY, team_id uuid, type text, location text,
 starts_at timestamptz, ends_at timestamptz, meet_at timestamptz, home_team text, away_team text);
CREATE TABLE players (id uuid PRIMARY KEY, team_id uuid, user_id uuid, member_user_id uuid);
CREATE TABLE event_plans (event_id uuid PRIMARY KEY, team_id uuid, created_by uuid,
 notes text, planning_done boolean, focus_areas text[], goal text);
CREATE TABLE event_resources (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, event_id uuid,
 team_id uuid, created_by uuid, kind text, resource_id text, minutes int, note text, sort_order int, details jsonb);
CREATE TABLE event_squad (event_id uuid, team_id uuid, player_id uuid, created_by uuid);
CREATE TABLE event_coaches (event_id uuid, team_id uuid, user_id uuid, created_by uuid);
CREATE TABLE match_lineups (event_id uuid PRIMARY KEY, team_id uuid, formation text,
 slots jsonb, bench jsonb, tactic_id uuid, created_by uuid);
CREATE TABLE event_invitations (id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 event_id uuid, team_id uuid, player_id uuid, status text DEFAULT 'pending');
CREATE TABLE player_guardians (player_id uuid, guardian_user_id uuid, is_active boolean);
CREATE TABLE event_change_log (id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 event_id uuid, team_id uuid, changed_by uuid, changed_fields jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE app_notifications (id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 user_id uuid, team_id uuid, event_id uuid, kind text, title text, body text,
 created_by uuid, created_at timestamptz DEFAULT now());
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$function$;

CREATE FUNCTION public.is_platform_admin(uid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
 SET search_path TO public AS $fn$ SELECT public.has_role(uid, 'admin') $fn$;
CREATE OR REPLACE FUNCTION public.is_team_coach(_team_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = _user_id
      AND role IN ('coach', 'head_coach', 'club_admin')
      AND status = 'approved'
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_team_member(_team_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id AND status = 'approved'
  )
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

CREATE OR REPLACE FUNCTION public.is_guardian_of(_player_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.player_guardians g
    JOIN public.players p ON p.id = g.player_id
    JOIN public.team_members m
      ON m.team_id = p.team_id AND m.user_id = g.guardian_user_id AND m.status = 'approved'
    WHERE g.player_id = _player_id
      AND g.guardian_user_id = auth.uid()
      AND g.is_active
  )
$function$;
GRANT USAGE ON SCHEMA public, auth TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin full access" ON public.teams FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
CREATE POLICY "coaches update teams" ON public.teams FOR UPDATE TO authenticated USING (((auth.uid() = created_by) OR is_team_coach(id, auth.uid()))) WITH CHECK (((auth.uid() = created_by) OR is_team_coach(id, auth.uid())));
CREATE POLICY "creator deletes team" ON public.teams FOR DELETE TO authenticated USING ((auth.uid() = created_by));
CREATE POLICY "members create own teams" ON public.teams FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));
CREATE POLICY "teams visible to members and admins" ON public.teams FOR SELECT TO authenticated USING (((auth.uid() = created_by) OR is_team_member(id, auth.uid()) OR (EXISTS ( SELECT 1
   FROM team_members m
  WHERE ((m.team_id = teams.id) AND (m.user_id = auth.uid())))) OR has_role(auth.uid(), 'admin'::app_role)));
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin full access" ON public.events FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
CREATE POLICY "coaches manage events" ON public.events FOR ALL TO authenticated USING (is_team_coach(team_id, auth.uid())) WITH CHECK (is_team_coach(team_id, auth.uid()));
CREATE POLICY "team reads events" ON public.events FOR SELECT TO authenticated USING ((is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guardians read own child" ON public.players FOR SELECT TO authenticated USING (is_guardian_of(id));
CREATE POLICY "Platform admin full access" ON public.players FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
CREATE POLICY "coaches manage team players" ON public.players FOR ALL TO authenticated USING (((team_id IS NOT NULL) AND is_team_coach(team_id, auth.uid()))) WITH CHECK (((team_id IS NOT NULL) AND is_team_coach(team_id, auth.uid())));
CREATE POLICY "own players" ON public.players FOR ALL TO authenticated USING (((auth.uid() = user_id) AND ((team_id IS NULL) OR is_team_coach(team_id, auth.uid())))) WITH CHECK (((auth.uid() = user_id) AND ((team_id IS NULL) OR is_team_coach(team_id, auth.uid()))));
CREATE POLICY "team players readable by team" ON public.players FOR SELECT TO authenticated USING (((team_id IS NOT NULL) AND (is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))));
ALTER TABLE public.event_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin full access" ON public.event_plans FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
CREATE POLICY "coaches manage event plans" ON public.event_plans FOR ALL TO authenticated USING (is_team_coach(team_id, auth.uid())) WITH CHECK ((is_team_coach(team_id, auth.uid()) AND (created_by = auth.uid())));
CREATE POLICY "team reads event plans" ON public.event_plans FOR SELECT TO authenticated USING ((is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
ALTER TABLE public.event_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin full access" ON public.event_resources FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
CREATE POLICY "coaches manage event resources" ON public.event_resources FOR ALL TO authenticated USING (is_team_coach(team_id, auth.uid())) WITH CHECK ((is_team_coach(team_id, auth.uid()) AND (created_by = auth.uid())));
CREATE POLICY "team reads event resources" ON public.event_resources FOR SELECT TO authenticated USING ((is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
ALTER TABLE public.event_squad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admin full access" ON public.event_squad FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
CREATE POLICY "coaches manage event squad" ON public.event_squad FOR ALL TO authenticated USING (is_team_coach(team_id, auth.uid())) WITH CHECK ((is_team_coach(team_id, auth.uid()) AND (created_by = auth.uid())));
CREATE POLICY "team reads event squad" ON public.event_squad FOR SELECT TO authenticated USING ((is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
ALTER TABLE public.event_coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lagmedlemmar ser ansvariga tranare" ON public.event_coaches FOR SELECT TO authenticated USING (is_team_member(team_id, auth.uid()));
CREATE POLICY "Platform admin full access" ON public.event_coaches FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
CREATE POLICY "Tranare hanterar ansvariga tranare" ON public.event_coaches FOR ALL TO authenticated USING (is_team_coach(team_id, auth.uid())) WITH CHECK ((is_team_coach(team_id, auth.uid()) AND (created_by = auth.uid())));
ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lagmedlemmar ser uppställningen" ON public.match_lineups FOR SELECT TO authenticated USING ((is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Ledare hanterar uppställningen" ON public.match_lineups FOR INSERT TO authenticated WITH CHECK (is_team_coach(team_id, auth.uid()));
CREATE POLICY "Ledare tar bort uppställningen" ON public.match_lineups FOR DELETE TO authenticated USING (is_team_coach(team_id, auth.uid()));
CREATE POLICY "Ledare ändrar uppställningen" ON public.match_lineups FOR UPDATE TO authenticated USING (is_team_coach(team_id, auth.uid())) WITH CHECK (is_team_coach(team_id, auth.uid()));
CREATE POLICY "Platform admin full access" ON public.match_lineups FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
