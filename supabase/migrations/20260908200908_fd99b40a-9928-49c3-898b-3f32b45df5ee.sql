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

REVOKE ALL ON FUNCTION public.invite_recipient_users(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_recipient_users(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.save_invitation_plan(_event_id uuid, _new_player_ids uuid[], _message text, _respond_by date, _notify boolean DEFAULT false, _update_existing boolean DEFAULT true, _op_id text DEFAULT NULL::text)
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
  cur_respond_by date;
  prior jsonb;
  payload jsonb;
  prior_row public.operation_results;
  claimed boolean := false;
  tries int := 0;
  _added int := 0;
  _updated int := 0;
  _notified int := 0;
  _account int := 0;
  _guardian int := 0;
  _unreachable int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;

  WHILE NOT claimed AND tries < 3 LOOP
    tries := tries + 1;
    INSERT INTO public.operation_results (op_id, user_id, scope, target_id, result)
    VALUES (op, uid, 'save_invitation_plan', _event_id, NULL)
    ON CONFLICT (op_id) DO NOTHING;
    IF FOUND THEN
      claimed := true;
      EXIT;
    END IF;

    SELECT * INTO prior_row FROM public.operation_results WHERE op_id = op FOR UPDATE;
    IF prior_row.op_id IS NULL THEN
      CONTINUE;
    END IF;

    IF prior_row.scope IS DISTINCT FROM 'save_invitation_plan'
       OR prior_row.user_id IS DISTINCT FROM uid
       OR prior_row.target_id IS DISTINCT FROM _event_id THEN
      RAISE EXCEPTION 'Handlingens id hör till en annan begäran.';
    END IF;

    SELECT * INTO ev FROM public.events WHERE id = _event_id;
    IF ev.id IS NULL THEN RAISE EXCEPTION 'Matchen hittades inte.'; END IF;
    IF NOT public.is_team_coach(ev.team_id, uid) AND NOT public.has_role(uid, 'admin') THEN
      RAISE EXCEPTION 'Endast lagets ledare kan hantera kallelsen.';
    END IF;

    prior := prior_row.result;
    IF prior IS NULL THEN
      RAISE EXCEPTION 'Samma begäran pågår redan. Försök igen om en stund.';
    END IF;
    RETURN prior || jsonb_build_object('replayed', true);
  END LOOP;

  IF NOT claimed THEN
    RAISE EXCEPTION 'Kallelsen kunde inte sparas just nu. Försök igen.';
  END IF;

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

  SELECT max(respond_by) INTO cur_respond_by
  FROM public.event_invitations
  WHERE event_id = _event_id AND status <> 'revoked';

  IF _respond_by IS NOT NULL AND _respond_by < current_date
     AND _respond_by IS DISTINCT FROM cur_respond_by THEN
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

  IF _update_existing THEN
    WITH upd AS (
      UPDATE public.event_invitations
      SET message = _message, respond_by = _respond_by, updated_at = now()
      WHERE event_id = _event_id AND status <> 'revoked'
      RETURNING id
    )
    SELECT count(*) INTO _updated FROM upd;
  END IF;

  CREATE TEMP TABLE _plan_notified (user_id uuid PRIMARY KEY) ON COMMIT DROP;

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

    INSERT INTO _plan_notified (user_id)
    SELECT DISTINCT r.user_id
    FROM _plan_added na
    CROSS JOIN LATERAL public.invite_recipient_users(na.player_id, ev.team_id) r
    ON CONFLICT DO NOTHING;

    INSERT INTO public.app_notifications
      (user_id, team_id, event_id, kind, title, body, created_by, dedupe_key)
    SELECT n.user_id, ev.team_id, _event_id, 'invite_published',
           'Ny kallelse',
           COALESCE(NULLIF(_message, ''), 'Du har fått en kallelse till en match.'),
           uid,
           'invite_published:' || op || ':' || n.user_id::text
    FROM _plan_notified n
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;

  IF _notify AND _updated > 0 THEN
    WITH targets AS (
      SELECT DISTINCT r.user_id
      FROM public.event_invitations i
      CROSS JOIN LATERAL public.invite_recipient_users(i.player_id, ev.team_id) r
      WHERE i.event_id = _event_id
        AND i.status <> 'revoked'
        AND NOT (i.player_id = ANY(ids))
        AND NOT EXISTS (SELECT 1 FROM _plan_notified n WHERE n.user_id = r.user_id)
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
      count(*) FILTER (WHERE p.member_user_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.team_members m
                    WHERE m.team_id = ev.team_id AND m.user_id = p.member_user_id
                      AND m.status = 'approved')),
      count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.team_members m
                    WHERE m.team_id = ev.team_id AND m.user_id = p.member_user_id
                      AND m.status = 'approved')
        AND EXISTS (SELECT 1 FROM public.invite_recipient_users(p.id, ev.team_id))),
      count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM public.invite_recipient_users(p.id, ev.team_id)))
    INTO _account, _guardian, _unreachable
    FROM public.players p WHERE p.id = ANY(ids);
  END IF;

  payload := jsonb_build_object(
    'added', _added,
    'updated', _updated,
    'notified', _notified,
    'operation_id', op,
    'selected', COALESCE(array_length(ids, 1), 0),
    'reachable_account', _account,
    'reachable_guardian', _guardian,
    'unreachable', _unreachable
  );

  UPDATE public.operation_results SET result = payload WHERE op_id = op;

  RETURN payload;
END;
$function$;

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
$function$;