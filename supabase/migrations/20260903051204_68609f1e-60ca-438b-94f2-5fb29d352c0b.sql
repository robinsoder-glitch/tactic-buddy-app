CREATE OR REPLACE FUNCTION public.send_invite_reminders(_event_id uuid, _title text, _body text)
 RETURNS TABLE(sent integer, skipped_recent integer, missing_account integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  _sent int := 0;
  _recent int := 0;
  _missing int := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT team_id INTO tid FROM public.events WHERE id = _event_id;
  IF tid IS NULL THEN
    RAISE EXCEPTION 'Aktiviteten hittades inte.';
  END IF;
  IF NOT public.is_team_coach(tid, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan skicka påminnelser.';
  END IF;

  -- Serialisera påminnelser per aktivitet så att två snabba tryck inte skapar dubbletter
  PERFORM pg_advisory_xact_lock(hashtextextended(_event_id::text, 0));

  CREATE TEMP TABLE _targets ON COMMIT DROP AS
  SELECT i.id AS invitation_id,
         i.player_id,
         i.last_reminder_at,
         u.user_id
  FROM public.event_invitations i
  LEFT JOIN LATERAL (
    SELECT p.member_user_id AS user_id FROM public.players p WHERE p.id = i.player_id
    UNION
    SELECT g.guardian_user_id FROM public.player_guardians g
      WHERE g.player_id = i.player_id AND g.is_active
  ) u ON true
  WHERE i.event_id = _event_id AND i.status = 'pending';

  SELECT count(DISTINCT invitation_id) INTO _recent
  FROM _targets WHERE last_reminder_at IS NOT NULL AND last_reminder_at > now() - interval '5 minutes';

  SELECT count(DISTINCT invitation_id) INTO _missing
  FROM _targets WHERE user_id IS NULL;

  WITH fresh AS (
    SELECT DISTINCT invitation_id, user_id
    FROM _targets
    WHERE user_id IS NOT NULL
      AND (last_reminder_at IS NULL OR last_reminder_at <= now() - interval '5 minutes')
  ), ins AS (
    INSERT INTO public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by)
    SELECT user_id, tid, _event_id, 'invite_reminder', _title, _body, uid FROM fresh
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

  RETURN QUERY SELECT _sent, _recent, _missing;
END;
$function$;