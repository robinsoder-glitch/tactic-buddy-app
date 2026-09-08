alter table public.operation_results alter column result drop not null;

create or replace function public.save_invitation_plan(_event_id uuid, _new_player_ids uuid[], _message text, _respond_by date, _notify boolean default false, _update_existing boolean default true, _op_id text default null::text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
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

  -- Anspråk på handlingen: bara en samtidig körning får utföra den.
  -- Övriga väntar in resultatet och återger samma kvitto.
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
      CONTINUE; -- den andra körningen avbröts, försök ta anspråket igen
    END IF;

    IF prior_row.scope IS DISTINCT FROM 'save_invitation_plan'
       OR prior_row.user_id IS DISTINCT FROM uid
       OR prior_row.target_id IS DISTINCT FROM _event_id THEN
      RAISE EXCEPTION 'Handlingens id hör till en annan begäran.';
    END IF;

    -- Behörighet kontrolleras även när ett tidigare resultat återges.
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
      WHERE i.event_id = _event_id
        AND i.status <> 'revoked'
        AND u.user_id IS NOT NULL
        AND NOT (i.player_id = ANY(ids))
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