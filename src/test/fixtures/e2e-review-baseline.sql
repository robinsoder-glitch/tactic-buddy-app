-- Utökat underlag för de fem databasfynden. Endast lokala testdata.
CREATE TABLE clubs (id uuid PRIMARY KEY, name text, created_by uuid);
ALTER TABLE teams ADD COLUMN club_id uuid REFERENCES clubs(id) ON DELETE SET NULL;
ALTER TABLE teams ADD COLUMN age_group text;
ALTER TABLE teams ADD COLUMN archived_at timestamptz;
ALTER TABLE team_members ADD CONSTRAINT test_member_team_fk FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE players ADD COLUMN name text;
ALTER TABLE players ADD COLUMN is_active boolean DEFAULT true;
ALTER TABLE players ADD COLUMN left_at timestamptz;
ALTER TABLE events ADD COLUMN cancelled_at timestamptz;
ALTER TABLE events ADD COLUMN invites_closed_at timestamptz;
ALTER TABLE event_invitations ADD COLUMN last_reminder_at timestamptz;
ALTER TABLE event_invitations ADD COLUMN revoked_at timestamptz;
ALTER TABLE event_invitations ADD COLUMN revoked_by uuid;
ALTER TABLE event_invitations ADD COLUMN updated_at timestamptz;
ALTER TABLE app_notifications ADD COLUMN dedupe_key text;
ALTER TABLE app_notifications ADD COLUMN priority text;
CREATE UNIQUE INDEX test_notice_dedupe ON app_notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE TABLE team_invites (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, team_id uuid, token text, role text, email text, expires_at timestamptz, revoked_at timestamptz, accepted_at timestamptz);
CREATE TABLE profiles (id uuid, display_name text);
CREATE TABLE team_announcements (id uuid, team_id uuid);
CREATE TABLE announcement_recipients (announcement_id uuid);
CREATE TABLE session_runs (id uuid, team_id uuid);
CREATE TABLE session_run_attendance (run_id uuid);
CREATE TABLE session_run_items (run_id uuid);
CREATE TABLE session_run_player_notes (run_id uuid);
CREATE TABLE team_periods (id uuid, team_id uuid);
CREATE TABLE period_links (period_id uuid);
CREATE TABLE period_progression (period_id uuid);
CREATE TABLE event_attendance (team_id uuid);
CREATE TABLE event_invitation_log (team_id uuid);
CREATE TABLE event_messages (team_id uuid);
CREATE TABLE match_shares (team_id uuid);
CREATE TABLE player_observations (team_id uuid);
CREATE TABLE player_focus_areas (team_id uuid);
CREATE TABLE player_stats (team_id uuid);
CREATE TABLE team_chat_messages (team_id uuid);
CREATE TABLE team_chat_reads (team_id uuid);
CREATE TABLE team_photos (team_id uuid);
CREATE TABLE team_join_codes (team_id uuid);
CREATE TABLE coach_sessions (team_id uuid);
CREATE TABLE coach_drills (team_id uuid);
CREATE TABLE tactics (team_id uuid);
GRANT USAGE ON SCHEMA public, auth TO anon, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read" ON team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "coach or self deletes member" ON team_members FOR DELETE TO authenticated USING (user_id=auth.uid() OR is_team_coach(team_id,auth.uid()));
CREATE POLICY "coaches update members" ON team_members FOR UPDATE TO authenticated USING (is_team_coach(team_id,auth.uid())) WITH CHECK (is_team_coach(team_id,auth.uid()));
CREATE POLICY "Platform admin full access" ON team_members FOR ALL TO authenticated USING (is_platform_admin(auth.uid())) WITH CHECK (is_platform_admin(auth.uid()));
-- Gemensamt mottagarurval: bara godkända medlemmar i rätt lag.
CREATE OR REPLACE FUNCTION public.invite_recipient_users(_player_id uuid, _team_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT u.uid
  FROM (
    SELECT p.member_user_id AS uid FROM public.players p
      WHERE p.id = _player_id AND p.team_id = _team_id
    UNION
    SELECT g.guardian_user_id FROM public.player_guardians g
      JOIN public.players p2 ON p2.id = g.player_id
      WHERE g.player_id = _player_id AND g.is_active AND p2.team_id = _team_id
  ) u
  WHERE u.uid IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members m
      WHERE m.team_id = _team_id AND m.user_id = u.uid AND m.status = 'approved'
    );
$$;

CREATE OR REPLACE FUNCTION public.send_invite_reminders(_event_id uuid, _title text, _body text)
 RETURNS TABLE(sent integer, skipped_recent integer, missing_account integer, unreachable_players text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  ev public.events;
  _sent int := 0;
  _recent int := 0;
  _missing int := 0;
  _names text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  SELECT * INTO ev FROM public.events WHERE id = _event_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'Aktiviteten hittades inte.'; END IF;
  IF NOT public.is_team_coach(ev.team_id, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan skicka påminnelser.';
  END IF;
  IF ev.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Matchen är inställd. Ingen påminnelse skickas.';
  END IF;
  IF ev.invites_closed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Kallelsen är stängd för svar. Ingen påminnelse skickas.';
  END IF;
  IF ev.starts_at < now() THEN
    RAISE EXCEPTION 'Matchen har redan börjat. Ingen påminnelse skickas.';
  END IF;

  -- Två samtidiga tryck ska inte kunna skicka dubbla påminnelser.
  PERFORM pg_advisory_xact_lock(hashtextextended('invite_reminders:' || _event_id::text, 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.event_invitations i
    WHERE i.event_id = _event_id AND i.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Alla kallade har svarat. Ingen påminnelse behövs.';
  END IF;

  CREATE TEMP TABLE _targets ON COMMIT DROP AS
  SELECT i.id AS invitation_id,
         i.player_id,
         p.name AS player_name,
         i.last_reminder_at,
         r.user_id
  FROM public.event_invitations i
  JOIN public.players p ON p.id = i.player_id
  LEFT JOIN LATERAL public.invite_recipient_users(i.player_id, ev.team_id) r ON true
  WHERE i.event_id = _event_id AND i.status = 'pending';

  SELECT count(DISTINCT invitation_id) INTO _recent
  FROM _targets
  WHERE user_id IS NOT NULL
    AND last_reminder_at IS NOT NULL AND last_reminder_at > now() - interval '5 minutes';

  -- Ett barn med en nåbar vuxen räknas aldrig som utan konto.
  SELECT count(*), string_agg(player_name, ', ' ORDER BY player_name)
  INTO _missing, _names
  FROM (
    SELECT invitation_id, min(player_name) AS player_name
    FROM _targets
    GROUP BY invitation_id
    HAVING count(user_id) = 0
  ) miss;

  WITH fresh AS (
    SELECT user_id, string_agg(DISTINCT player_name, ' och ') AS names
    FROM _targets
    WHERE user_id IS NOT NULL
      AND (last_reminder_at IS NULL OR last_reminder_at <= now() - interval '5 minutes')
    GROUP BY user_id
  ), ins AS (
    INSERT INTO public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by, dedupe_key)
    SELECT user_id, ev.team_id, _event_id, 'invite_reminder', _title,
           _body || ' – gäller ' || names, uid,
           'invite_reminder:' || _event_id::text || ':' || user_id::text || ':'
             || to_char(date_trunc('hour', now()), 'YYYYMMDDHH24')
    FROM fresh
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO _sent FROM ins;

  UPDATE public.event_invitations
  SET last_reminder_at = now()
  WHERE id IN (
    SELECT DISTINCT invitation_id FROM _targets
    WHERE user_id IS NOT NULL
      AND (last_reminder_at IS NULL OR last_reminder_at <= now() - interval '5 minutes')
  );

  RETURN QUERY SELECT _sent, _recent, _missing, COALESCE(_names, '');
END;
$function$;create or replace function public.announcement_audience(
  _team_id uuid,
  _event_id uuid,
  _audience_type text,
  _manual uuid[]
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with event_players as (
    select i.player_id, i.status
    from public.event_invitations i
    where _event_id is not null and i.event_id = _event_id
  ),
  event_users as (
    select distinct u.user_id
    from event_players ep
    join public.players p on p.id = ep.player_id
    cross join lateral (
      select p.member_user_id as user_id
      union all
      select g.guardian_user_id from public.player_guardians g
        where g.player_id = p.id and g.is_active
    ) u
    where u.user_id is not null
      and (
        _audience_type = 'event_invited'
        or (_audience_type = 'event_going' and ep.status = 'going')
        or (_audience_type = 'event_no_reply' and coalesce(ep.status,'no_reply') in ('no_reply','pending'))
      )
  ),
  member_users as (
    select distinct m.user_id
    from public.team_members m
    where m.team_id = _team_id and m.status = 'approved'
      and (
        _audience_type = 'all'
        or (_audience_type = 'coaches' and m.role = 'coach')
        or (_audience_type = 'players' and m.role = 'player')
        or (_audience_type = 'guardians' and m.role = 'guardian')
      )
  ),
  guardian_users as (
    select distinct g.guardian_user_id as user_id
    from public.player_guardians g
    join public.players p on p.id = g.player_id
    where _audience_type = 'guardians' and g.is_active and p.team_id = _team_id
      and g.guardian_user_id is not null
  ),
  manual_users as (
    select distinct m.user_id
    from public.team_members m
    where _audience_type = 'manual' and m.team_id = _team_id and m.status = 'approved'
      and m.user_id = any(coalesce(_manual, '{}'::uuid[]))
  )
  select user_id from member_users
  union
  select user_id from guardian_users
  union
  select user_id from event_users
  union
  select user_id from manual_users;
$$;
revoke all on function public.announcement_audience(uuid, uuid, text, uuid[]) from public, anon;
grant execute on function public.announcement_audience(uuid, uuid, text, uuid[]) to authenticated, service_role;

-- Förhandsvisning av mottagare
create or replace function public.preview_announcement_audience(
  _team_id uuid,
  _event_id uuid,
  _audience_type text,
  _manual uuid[] default '{}'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total int;
  v_guardians int;
  v_players int;
  v_coaches int;
  v_without int;
begin
  if not public.is_team_coach(_team_id, auth.uid()) then
    raise exception 'Endast lagets tränare kan skicka meddelanden.';
  end if;
  if _event_id is not null and not exists (
    select 1 from public.events e where e.id = _event_id and e.team_id = _team_id
  ) then
    raise exception 'Aktiviteten tillhör inte laget.';
  end if;
  if _audience_type in ('event_invited','event_going','event_no_reply') and _event_id is null then
    raise exception 'Välj en aktivitet för den här målgruppen.';
  end if;

  select
    count(*),
    count(*) filter (where exists (
      select 1 from public.team_members m
      where m.user_id = a.user_id and m.team_id = _team_id and m.status='approved' and m.role='coach')),
    count(*) filter (where exists (
      select 1 from public.team_members m
      where m.user_id = a.user_id and m.team_id = _team_id and m.status='approved' and m.role='player')),
    count(*) filter (where exists (
      select 1 from public.player_guardians g join public.players p on p.id = g.player_id
      where g.guardian_user_id = a.user_id and g.is_active and p.team_id = _team_id)
      or exists (
      select 1 from public.team_members m
      where m.user_id = a.user_id and m.team_id = _team_id and m.status='approved' and m.role='guardian'))
  into v_total, v_coaches, v_players, v_guardians
  from public.announcement_audience(_team_id, _event_id, _audience_type, _manual) a;

  select count(*) into v_without
  from public.players p
  where p.team_id = _team_id and coalesce(p.is_active, true)
    and p.member_user_id is null
    and not exists (
      select 1 from public.player_guardians g
      where g.player_id = p.id and g.is_active and g.guardian_user_id is not null
    )
    and (
      _event_id is null
      or exists (select 1 from public.event_invitations i where i.event_id=_event_id and i.player_id=p.id)
    );

  return jsonb_build_object(
    'recipients', coalesce(v_total,0),
    'coaches', coalesce(v_coaches,0),
    'players', coalesce(v_players,0),
    'guardians', coalesce(v_guardians,0),
    'without_account', coalesce(v_without,0)
  );
end;
$$;
revoke all on function public.preview_announcement_audience(uuid, uuid, text, uuid[]) from public, anon;
grant execute on function public.preview_announcement_audience(uuid, uuid, text, uuid[]) to authenticated;
CREATE OR REPLACE FUNCTION public.delete_own_team(_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  t public.teams;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT * INTO t FROM public.teams WHERE id = _team_id FOR UPDATE;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Laget hittades inte.';
  END IF;

  IF t.created_by <> uid AND NOT public.is_platform_admin(uid) THEN
    RAISE EXCEPTION 'Bara tränaren som skapade laget kan radera det.';
  END IF;

  DELETE FROM public.event_attendance WHERE team_id = _team_id;
  DELETE FROM public.event_coaches WHERE team_id = _team_id;
  DELETE FROM public.event_invitation_log WHERE team_id = _team_id;
  DELETE FROM public.event_invitations WHERE team_id = _team_id;
  DELETE FROM public.event_messages WHERE team_id = _team_id;
  DELETE FROM public.event_plans WHERE team_id = _team_id;
  DELETE FROM public.event_resources WHERE team_id = _team_id;
  DELETE FROM public.event_squad WHERE team_id = _team_id;
  DELETE FROM public.event_change_log WHERE team_id = _team_id;
  DELETE FROM public.match_lineups WHERE team_id = _team_id;
  DELETE FROM public.match_shares WHERE team_id = _team_id;

  DELETE FROM public.announcement_recipients ar
  USING public.team_announcements ta
  WHERE ar.announcement_id = ta.id AND ta.team_id = _team_id;
  DELETE FROM public.team_announcements WHERE team_id = _team_id;

  DELETE FROM public.session_run_attendance sra
  USING public.session_runs sr
  WHERE sra.run_id = sr.id AND sr.team_id = _team_id;
  DELETE FROM public.session_run_items sri
  USING public.session_runs sr
  WHERE sri.run_id = sr.id AND sr.team_id = _team_id;
  DELETE FROM public.session_run_player_notes srn
  USING public.session_runs sr
  WHERE srn.run_id = sr.id AND sr.team_id = _team_id;
  DELETE FROM public.session_runs WHERE team_id = _team_id;

  DELETE FROM public.period_links pl
  USING public.team_periods tp
  WHERE pl.period_id = tp.id AND tp.team_id = _team_id;
  DELETE FROM public.period_progression pp
  USING public.team_periods tp
  WHERE pp.period_id = tp.id AND tp.team_id = _team_id;

  DELETE FROM public.player_observations WHERE team_id = _team_id;
  DELETE FROM public.player_focus_areas WHERE team_id = _team_id;
  DELETE FROM public.team_periods WHERE team_id = _team_id;
  DELETE FROM public.player_stats WHERE team_id = _team_id;
  DELETE FROM public.player_guardians g
  USING public.players p
  WHERE g.player_id = p.id AND p.team_id = _team_id;

  DELETE FROM public.team_chat_messages WHERE team_id = _team_id;
  DELETE FROM public.team_chat_reads WHERE team_id = _team_id;
  DELETE FROM public.team_photos WHERE team_id = _team_id;
  DELETE FROM public.team_invites WHERE team_id = _team_id;
  DELETE FROM public.team_join_codes WHERE team_id = _team_id;
  DELETE FROM public.app_notifications WHERE team_id = _team_id;

  UPDATE public.coach_sessions SET team_id = NULL WHERE team_id = _team_id;
  UPDATE public.coach_drills SET team_id = NULL WHERE team_id = _team_id;
  UPDATE public.tactics SET team_id = NULL WHERE team_id = _team_id;

  DELETE FROM public.events WHERE team_id = _team_id;
  DELETE FROM public.players WHERE team_id = _team_id;
  DELETE FROM public.team_members WHERE team_id = _team_id;
  DELETE FROM public.teams WHERE id = _team_id;

  RETURN jsonb_build_object('team_name', t.name, 'deleted', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_own_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_team(uuid) TO authenticated;CREATE OR REPLACE FUNCTION public.leave_team(_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.teams;
  roles text[];
  is_leader boolean;
  other_leaders int;
  left_player_ids uuid[];
  cleared_players int := 0;
  cleared_guardians int := 0;
  revoked_invites int := 0;
  notified int := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT * INTO t FROM public.teams WHERE id = _team_id FOR UPDATE;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Laget hittades inte.';
  END IF;

  SELECT array_agg(role) INTO roles
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = uid;

  IF roles IS NULL THEN
    RAISE EXCEPTION 'Du är inte med i laget.';
  END IF;

  is_leader := roles && ARRAY['coach', 'head_coach', 'club_admin'];

  IF t.created_by = uid THEN
    RAISE EXCEPTION 'Du har skapat laget och kan inte lämna det. Radera laget i stället.';
  END IF;

  IF is_leader THEN
    SELECT count(*) INTO other_leaders
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id <> uid
      AND status = 'approved'
      AND role IN ('coach', 'head_coach', 'club_admin');
    IF other_leaders = 0 THEN
      RAISE EXCEPTION 'Du är lagets enda ledare. Bjud in en ny ledare innan du lämnar laget.';
    END IF;
  END IF;

  SELECT coalesce(array_agg(id), '{}'::uuid[]) INTO left_player_ids
  FROM public.players
  WHERE team_id = _team_id AND member_user_id = uid;

  UPDATE public.players
  SET member_user_id = NULL, is_active = false, left_at = now()
  WHERE id = ANY(left_player_ids);
  GET DIAGNOSTICS cleared_players = ROW_COUNT;

  UPDATE public.player_guardians g
  SET is_active = false
  FROM public.players p
  WHERE g.player_id = p.id
    AND p.team_id = _team_id
    AND g.guardian_user_id = uid
    AND g.is_active;
  GET DIAGNOSTICS cleared_guardians = ROW_COUNT;

  IF coalesce(array_length(left_player_ids, 1), 0) > 0 THEN
    UPDATE public.event_invitations i
    SET status = 'revoked', revoked_at = now(), revoked_by = uid, updated_at = now()
    FROM public.events e
    WHERE i.event_id = e.id
      AND i.team_id = _team_id
      AND i.player_id = ANY(left_player_ids)
      AND i.status = 'pending'
      AND e.starts_at >= now();
    GET DIAGNOSTICS revoked_invites = ROW_COUNT;

    DELETE FROM public.event_squad s
    USING public.events e
    WHERE s.event_id = e.id
      AND s.team_id = _team_id
      AND s.player_id = ANY(left_player_ids)
      AND e.starts_at >= now();
  END IF;

  DELETE FROM public.team_members WHERE team_id = _team_id AND user_id = uid;
  DELETE FROM public.event_coaches WHERE team_id = _team_id AND user_id = uid;

  INSERT INTO public.app_notifications (user_id, team_id, kind, title, body, created_by, priority)
  SELECT m.user_id, _team_id, 'member_left',
         'Någon har lämnat laget',
         coalesce(nullif(btrim(pr.display_name), ''), 'En medlem')
           || ' har lämnat ' || t.name
           || CASE WHEN cleared_players > 0
                THEN '. Spelaren finns kvar under Lämnade spelare.'
                ELSE '.' END,
         uid,
         'normal'
  FROM public.team_members m
  LEFT JOIN public.profiles pr ON pr.id = uid
  WHERE m.team_id = _team_id
    AND m.status = 'approved'
    AND m.role IN ('coach', 'head_coach', 'club_admin');
  GET DIAGNOSTICS notified = ROW_COUNT;

  RETURN jsonb_build_object(
    'team_name', t.name,
    'cleared_players', cleared_players,
    'cleared_guardian_links', cleared_guardians,
    'revoked_invitations', revoked_invites,
    'notified_leaders', notified
  );
END;
$$;

REVOKE ALL ON FUNCTION public.leave_team(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.leave_team(uuid) TO authenticated;