-- 1. Atomiskt kallelsesparande -------------------------------------------
CREATE OR REPLACE FUNCTION public.save_invitation_plan(
  _event_id uuid,
  _new_player_ids uuid[],
  _message text,
  _respond_by date,
  _notify boolean DEFAULT false,
  _update_existing boolean DEFAULT true,
  _op_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  ev public.events;
  op text := COALESCE(NULLIF(btrim(COALESCE(_op_id, '')), ''), gen_random_uuid()::text);
  ids uuid[] := COALESCE(_new_player_ids, '{}');
  _added int := 0;
  _updated int := 0;
  _notified int := 0;
  _account int := 0;
  _guardian int := 0;
  _unreachable int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;

  SELECT * INTO ev FROM public.events WHERE id = _event_id FOR UPDATE;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'Matchen hittades inte.'; END IF;
  IF NOT public.is_team_coach(ev.team_id, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan hantera kallelsen.';
  END IF;
  IF ev.type <> 'match' THEN
    RAISE EXCEPTION 'Kallelser skickas bara till matcher. Träningar hanteras via närvaro.';
  END IF;
  IF ev.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Matchen är inställd. Kallelsen kan inte ändras.';
  END IF;
  IF _respond_by IS NOT NULL AND _respond_by < current_date THEN
    RAISE EXCEPTION 'Sista svarsdag kan inte vara ett datum som redan passerat.';
  END IF;

  IF array_length(ids, 1) IS NOT NULL THEN
    IF COALESCE(ev.ends_at, ev.starts_at) < now() THEN
      RAISE EXCEPTION 'Matchen är redan spelad. Det går inte att kalla fler spelare.';
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(ids) pid
      LEFT JOIN public.players p ON p.id = pid
      WHERE p.id IS NULL OR p.team_id IS DISTINCT FROM ev.team_id
    ) THEN
      RAISE EXCEPTION 'En eller flera spelare tillhör inte laget.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.players p WHERE p.id = ANY(ids) AND p.is_active = false) THEN
      RAISE EXCEPTION 'Inaktiva spelare kan inte kallas.';
    END IF;
  END IF;

  -- Uppdatera befintliga kallelser
  IF _update_existing THEN
    WITH upd AS (
      UPDATE public.event_invitations
      SET message = _message, respond_by = _respond_by, updated_at = now()
      WHERE event_id = _event_id AND status <> 'revoked'
      RETURNING id
    )
    SELECT count(*) INTO _updated FROM upd;
  END IF;

  -- Nya och återaktiverade mottagare
  IF array_length(ids, 1) IS NOT NULL THEN
    CREATE TEMP TABLE _plan_added ON COMMIT DROP AS
    WITH ins AS (
      INSERT INTO public.event_invitations
        (event_id, team_id, player_id, message, respond_by, created_by)
      SELECT _event_id, ev.team_id, pid, _message, _respond_by, uid
      FROM unnest(ids) pid
      ON CONFLICT (event_id, player_id) DO UPDATE
        SET status = 'pending',
            message = EXCLUDED.message,
            respond_by = EXCLUDED.respond_by,
            revoked_at = NULL,
            revoked_by = NULL,
            responded_at = NULL,
            responded_by = NULL,
            responded_role = NULL,
            last_reminder_at = NULL,
            updated_at = now()
        WHERE public.event_invitations.status = 'revoked'
      RETURNING id, player_id, (xmax = 0) AS was_insert
    )
    SELECT * FROM ins;

    SELECT count(*) INTO _added FROM _plan_added;

    INSERT INTO public.event_invitation_log
      (invitation_id, team_id, from_status, to_status, changed_by, changed_role)
    SELECT id, ev.team_id, CASE WHEN was_insert THEN NULL ELSE 'revoked' END, 'pending', uid, 'coach'
    FROM _plan_added;

    INSERT INTO public.app_notifications
      (user_id, team_id, event_id, kind, title, body, created_by, dedupe_key)
    SELECT DISTINCT u.user_id, ev.team_id, _event_id, 'invite_published',
           'Ny kallelse',
           COALESCE(NULLIF(_message, ''), 'Du har fått en kallelse till en match.'),
           uid,
           'invite_published:' || op || ':' || u.user_id::text
    FROM _plan_added na
    CROSS JOIN LATERAL (
      SELECT p.member_user_id AS user_id FROM public.players p WHERE p.id = na.player_id
      UNION
      SELECT g.guardian_user_id FROM public.player_guardians g
        WHERE g.player_id = na.player_id AND g.is_active
    ) u
    WHERE u.user_id IS NOT NULL
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;

  -- Notis om ändrad information till redan kallade
  IF _notify AND _updated > 0 THEN
    WITH targets AS (
      SELECT DISTINCT u.user_id
      FROM public.event_invitations i
      CROSS JOIN LATERAL (
        SELECT p.member_user_id AS user_id FROM public.players p WHERE p.id = i.player_id
        UNION
        SELECT g.guardian_user_id FROM public.player_guardians g
          WHERE g.player_id = i.player_id AND g.is_active
      ) u
      WHERE i.event_id = _event_id AND i.status <> 'revoked' AND u.user_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.event_invitations x
                        WHERE x.event_id = _event_id AND x.player_id = i.player_id
                          AND x.created_at > now() - interval '1 second' AND false)
    ), ins AS (
      INSERT INTO public.app_notifications
        (user_id, team_id, event_id, kind, title, body, created_by, dedupe_key)
      SELECT user_id, ev.team_id, _event_id, 'invite_updated', 'Kallelsen har ändrats',
             COALESCE(NULLIF(_message, ''), 'Informationen i kallelsen har uppdaterats.'), uid,
             'invite_updated:' || op || ':' || user_id::text
      FROM targets
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO _notified FROM ins;
  END IF;

  IF array_length(ids, 1) IS NOT NULL THEN
    SELECT
      count(*) FILTER (WHERE p.member_user_id IS NOT NULL),
      count(*) FILTER (WHERE p.member_user_id IS NULL AND EXISTS (
        SELECT 1 FROM public.player_guardians g WHERE g.player_id = p.id AND g.is_active)),
      count(*) FILTER (WHERE p.member_user_id IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.player_guardians g WHERE g.player_id = p.id AND g.is_active))
    INTO _account, _guardian, _unreachable
    FROM public.players p WHERE p.id = ANY(ids);
  END IF;

  RETURN jsonb_build_object(
    'added', _added,
    'updated', _updated,
    'notified', _notified,
    'operation_id', op,
    'selected', COALESCE(array_length(ids, 1), 0),
    'reachable_account', _account,
    'reachable_guardian', _guardian,
    'unreachable', _unreachable
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.save_invitation_plan(uuid, uuid[], text, date, boolean, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_invitation_plan(uuid, uuid[], text, date, boolean, boolean, text) TO authenticated;

-- 2. Atomiskt taktiksparande ----------------------------------------------
CREATE OR REPLACE FUNCTION public.save_tactic_frames(_tactic_id uuid, _frames jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  t public.tactics;
  n int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  IF _frames IS NULL OR jsonb_typeof(_frames) <> 'array' THEN
    RAISE EXCEPTION 'Sekvensen kunde inte tolkas.';
  END IF;
  IF jsonb_array_length(_frames) = 0 THEN
    RAISE EXCEPTION 'Taktiken måste innehålla minst ett steg.';
  END IF;

  -- Låser taktiken så att två samtidiga sparningar körs i tur och ordning.
  SELECT * INTO t FROM public.tactics WHERE id = _tactic_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'Taktiken hittades inte.'; END IF;
  IF t.user_id <> uid AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Du kan bara spara dina egna taktiker.';
  END IF;

  DELETE FROM public.tactic_frames WHERE tactic_id = _tactic_id;

  INSERT INTO public.tactic_frames (tactic_id, user_id, position, name, note, objects, drawings)
  SELECT _tactic_id, t.user_id, (f.ord - 1)::int,
         NULLIF(f.value->>'name', ''),
         NULLIF(f.value->>'note', ''),
         COALESCE(f.value->'objects', '[]'::jsonb),
         COALESCE(f.value->'drawings', '[]'::jsonb)
  FROM jsonb_array_elements(_frames) WITH ORDINALITY AS f(value, ord);

  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.tactics SET updated_at = now() WHERE id = _tactic_id;
  RETURN n;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_tactic_frames(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_tactic_frames(uuid, jsonb) TO authenticated;

-- 3. Relations- och samtidighetsluckor ------------------------------------
CREATE OR REPLACE FUNCTION public.is_my_player(_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.players p
    JOIN public.team_members m
      ON m.team_id = p.team_id AND m.user_id = p.member_user_id AND m.status = 'approved'
    WHERE p.id = _player_id AND p.member_user_id = auth.uid()
  )
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

-- Ingen direkt ändring av vuxenkopplingar från klienten.
DROP POLICY IF EXISTS "Coaches update guardian links" ON public.player_guardians;

CREATE OR REPLACE FUNCTION public.set_guardian_active(_link_id uuid, _active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  SELECT p.team_id INTO tid
  FROM public.player_guardians g JOIN public.players p ON p.id = g.player_id
  WHERE g.id = _link_id;
  IF tid IS NULL THEN RAISE EXCEPTION 'Kopplingen hittades inte.'; END IF;
  IF NOT public.is_team_coach(tid, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan ändra kopplingen.';
  END IF;
  UPDATE public.player_guardians SET is_active = _active, updated_at = now() WHERE id = _link_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_guardian_active(uuid, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_guardian_active(uuid, boolean) TO authenticated;

-- Personlig inbjudan: lås spelarkortet och rulla tillbaka vid partiell koppling.
CREATE OR REPLACE FUNCTION public.accept_team_invite(_token text, _account_kind text DEFAULT NULL::text)
RETURNS TABLE(team_id uuid, member_role text, member_status text, already_member boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inv public.team_invites;
  t public.teams;
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  wanted text;
  new_status text;
  existing public.team_members;
  target public.players;
  n int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT * INTO inv FROM public.team_invites WHERE token = _token FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Länken är ogiltig.'; END IF;
  IF inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'Länken har återkallats.'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'Länken har redan använts.'; END IF;
  IF inv.expires_at <= now() THEN RAISE EXCEPTION 'Länken har gått ut.'; END IF;

  SELECT * INTO t FROM public.teams WHERE id = inv.team_id;
  IF t.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Laget är arkiverat och kan inte ta emot nya medlemmar.';
  END IF;

  IF inv.email IS NOT NULL AND lower(inv.email) <> mail THEN
    RAISE EXCEPTION 'Inbjudan gäller en annan e-postadress.';
  END IF;

  IF inv.role = 'coach' THEN
    wanted := 'coach';
  ELSIF _account_kind = 'guardian' THEN
    wanted := 'guardian';
  ELSE
    wanted := 'player';
  END IF;

  IF inv.target_player_id IS NOT NULL THEN
    -- Lås spelarkortet innan någon kontroll, så att två samtidiga
    -- accepteranden inte kan koppla samma kort till olika konton.
    SELECT * INTO target FROM public.players WHERE id = inv.target_player_id FOR UPDATE;
    IF target.id IS NULL OR target.team_id IS DISTINCT FROM inv.team_id THEN
      RAISE EXCEPTION 'Spelarkortet tillhör inte laget.';
    END IF;
    IF wanted = 'player' AND target.member_user_id IS NOT NULL AND target.member_user_id <> uid THEN
      RAISE EXCEPTION 'Spelarkortet är redan kopplat till ett annat konto. Kontakta lagets tränare.';
    END IF;
    IF wanted = 'guardian' AND target.member_user_id = uid THEN
      RAISE EXCEPTION 'Spelarens eget konto kan inte kopplas som vuxen.';
    END IF;
  END IF;

  SELECT * INTO existing FROM public.team_members m
  WHERE m.team_id = inv.team_id AND m.user_id = uid;

  IF existing.id IS NOT NULL AND existing.status = 'approved' THEN
    RETURN QUERY SELECT inv.team_id, existing.role, existing.status, true;
    RETURN;
  END IF;

  new_status := CASE
    WHEN inv.email IS NOT NULL OR inv.target_player_id IS NOT NULL THEN 'approved'
    ELSE 'pending'
  END;

  INSERT INTO public.team_members (team_id, user_id, role, status, joined_via)
  VALUES (inv.team_id, uid, wanted, new_status, 'invite_link')
  ON CONFLICT (team_id, user_id) DO UPDATE
    SET role = EXCLUDED.role, status = EXCLUDED.status, joined_via = EXCLUDED.joined_via;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Medlemskapet kunde inte skapas. Försök igen.';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, (CASE WHEN wanted = 'coach' THEN 'coach' ELSE 'player' END)::public.app_role)
  ON CONFLICT DO NOTHING;

  IF inv.target_player_id IS NOT NULL AND new_status = 'approved' THEN
    IF wanted = 'guardian' THEN
      INSERT INTO public.player_guardians (player_id, guardian_user_id, created_by, is_active)
      VALUES (inv.target_player_id, uid, inv.created_by, true)
      ON CONFLICT (player_id, guardian_user_id) DO UPDATE SET is_active = true;
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n <> 1 THEN
        RAISE EXCEPTION 'Kopplingen till barnet kunde inte skapas. Ingenting har sparats.';
      END IF;
    ELSIF wanted = 'player' THEN
      UPDATE public.players SET member_user_id = uid
      WHERE id = inv.target_player_id AND team_id = inv.team_id
        AND (member_user_id IS NULL OR member_user_id = uid);
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n <> 1 THEN
        RAISE EXCEPTION 'Spelarkortet kunde inte kopplas. Ingenting har sparats.';
      END IF;
    END IF;
  END IF;

  UPDATE public.team_invites
  SET accepted_at = now(), accepted_by = uid
  WHERE id = inv.id AND accepted_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Länken har redan använts.';
  END IF;

  RETURN QUERY SELECT inv.team_id, wanted, new_status, false;
END;
$function$;

-- Matchplanering: valda ledare måste vara godkända ledare i laget.
CREATE OR REPLACE FUNCTION public.save_match_plan(_event_id uuid, _team_id uuid, _notes text, _player_ids uuid[], _coach_ids uuid[], _formation text, _slots jsonb, _bench uuid[], _tactic_id uuid, _required integer)
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