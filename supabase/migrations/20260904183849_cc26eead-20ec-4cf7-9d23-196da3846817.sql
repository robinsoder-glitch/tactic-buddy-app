-- 1. Nya kolumner: återkallande och stängd kallelse
ALTER TABLE public.event_invitations
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS responded_role text;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS invites_closed_at timestamptz;

ALTER TABLE public.event_invitations DROP CONSTRAINT IF EXISTS event_invitations_status_check;
ALTER TABLE public.event_invitations
  ADD CONSTRAINT event_invitations_status_check
  CHECK (status IN ('pending','attending','declined','maybe','revoked'));

-- 2. Spelare och vårdnadshavare får inte längre uppdatera raden direkt
DROP POLICY IF EXISTS "Players answer own invitation" ON public.event_invitations;
DROP POLICY IF EXISTS "Guardians answer child invitation" ON public.event_invitations;

-- 3. Hjälpfunktion: vilken roll har inloggad användare för en kallelse?
CREATE OR REPLACE FUNCTION public.invitation_actor_role(_invitation_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  inv public.event_invitations;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO inv FROM public.event_invitations WHERE id = _invitation_id;
  IF inv.id IS NULL THEN RETURN NULL; END IF;
  IF public.is_team_coach(inv.team_id, uid) OR public.has_role(uid, 'admin') THEN
    RETURN 'coach';
  END IF;
  IF EXISTS (SELECT 1 FROM public.players p WHERE p.id = inv.player_id AND p.member_user_id = uid) THEN
    RETURN 'player';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.player_guardians g
    WHERE g.player_id = inv.player_id AND g.guardian_user_id = uid AND g.is_active
  ) THEN
    RETURN 'guardian';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.invitation_actor_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invitation_actor_role(uuid) TO authenticated;

-- 4. Publicera kallelse
CREATE OR REPLACE FUNCTION public.publish_event_invitations(
  _event_id uuid,
  _player_ids uuid[],
  _message text,
  _respond_by date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ev public.events;
  _added int := 0;
  _account int := 0;
  _guardian int := 0;
  _unreachable int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  SELECT * INTO ev FROM public.events WHERE id = _event_id FOR UPDATE;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'Matchen hittades inte.'; END IF;
  IF NOT public.is_team_coach(ev.team_id, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan publicera kallelser.';
  END IF;
  IF ev.type <> 'match' THEN
    RAISE EXCEPTION 'Kallelser skickas bara till matcher. Träningar hanteras via närvaro.';
  END IF;
  IF ev.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Matchen är inställd. Det går inte att kalla fler spelare.';
  END IF;
  IF COALESCE(ev.ends_at, ev.starts_at) < now() THEN
    RAISE EXCEPTION 'Matchen är redan spelad. Det går inte att kalla fler spelare.';
  END IF;
  IF _player_ids IS NULL OR array_length(_player_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Välj minst en spelare innan du publicerar kallelsen.';
  END IF;
  IF _respond_by IS NOT NULL AND _respond_by < current_date THEN
    RAISE EXCEPTION 'Sista svarsdag kan inte vara ett datum som redan passerat.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(_player_ids) pid
    LEFT JOIN public.players p ON p.id = pid
    WHERE p.id IS NULL OR p.team_id IS DISTINCT FROM ev.team_id
  ) THEN
    RAISE EXCEPTION 'En eller flera spelare tillhör inte laget.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.players p WHERE p.id = ANY(_player_ids) AND p.is_active = false
  ) THEN
    RAISE EXCEPTION 'Inaktiva spelare kan inte kallas.';
  END IF;

  WITH ins AS (
    INSERT INTO public.event_invitations
      (event_id, team_id, player_id, message, respond_by, created_by)
    SELECT _event_id, ev.team_id, pid, _message, _respond_by, uid
    FROM unnest(_player_ids) pid
    ON CONFLICT (event_id, player_id) DO NOTHING
    RETURNING player_id
  )
  SELECT count(*) INTO _added FROM ins;

  -- Notis direkt vid publicering, till spelarkonto och aktiva vårdnadshavare
  INSERT INTO public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by)
  SELECT DISTINCT u.user_id, ev.team_id, _event_id, 'invite_published',
         'Ny kallelse',
         COALESCE(NULLIF(_message, ''), 'Du har fått en kallelse till en match.'),
         uid
  FROM unnest(_player_ids) pid
  CROSS JOIN LATERAL (
    SELECT p.member_user_id AS user_id FROM public.players p WHERE p.id = pid
    UNION
    SELECT g.guardian_user_id FROM public.player_guardians g
      WHERE g.player_id = pid AND g.is_active
  ) u
  WHERE u.user_id IS NOT NULL;

  SELECT
    count(*) FILTER (WHERE p.member_user_id IS NOT NULL),
    count(*) FILTER (WHERE p.member_user_id IS NULL AND EXISTS (
      SELECT 1 FROM public.player_guardians g WHERE g.player_id = p.id AND g.is_active)),
    count(*) FILTER (WHERE p.member_user_id IS NULL AND NOT EXISTS (
      SELECT 1 FROM public.player_guardians g WHERE g.player_id = p.id AND g.is_active))
  INTO _account, _guardian, _unreachable
  FROM public.players p WHERE p.id = ANY(_player_ids);

  RETURN jsonb_build_object(
    'added', _added,
    'selected', array_length(_player_ids, 1),
    'reachable_account', _account,
    'reachable_guardian', _guardian,
    'unreachable', _unreachable
  );
END;
$$;
REVOKE ALL ON FUNCTION public.publish_event_invitations(uuid, uuid[], text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_event_invitations(uuid, uuid[], text, date) TO authenticated;

-- 5. Ändra kallelsens text och sista svarsdag
CREATE OR REPLACE FUNCTION public.update_invitation_details(
  _event_id uuid,
  _message text,
  _respond_by date,
  _notify boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ev public.events;
  _updated int := 0;
  _notified int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  SELECT * INTO ev FROM public.events WHERE id = _event_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'Matchen hittades inte.'; END IF;
  IF NOT public.is_team_coach(ev.team_id, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan ändra kallelsen.';
  END IF;
  IF _respond_by IS NOT NULL AND _respond_by < current_date THEN
    RAISE EXCEPTION 'Sista svarsdag kan inte vara ett datum som redan passerat.';
  END IF;

  WITH upd AS (
    UPDATE public.event_invitations
    SET message = _message, respond_by = _respond_by
    WHERE event_id = _event_id AND status <> 'revoked'
    RETURNING player_id
  )
  SELECT count(*) INTO _updated FROM upd;

  IF _notify THEN
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
    ), ins AS (
      INSERT INTO public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by)
      SELECT user_id, ev.team_id, _event_id, 'invite_updated', 'Kallelsen har ändrats',
             COALESCE(NULLIF(_message, ''), 'Informationen i kallelsen har uppdaterats.'), uid
      FROM targets
      RETURNING 1
    )
    SELECT count(*) INTO _notified FROM ins;
  END IF;

  RETURN jsonb_build_object('updated', _updated, 'notified', _notified);
END;
$$;
REVOKE ALL ON FUNCTION public.update_invitation_details(uuid, text, date, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_invitation_details(uuid, text, date, boolean) TO authenticated;

-- 6. Lämna svar (spelare, vårdnadshavare eller ledare)
CREATE OR REPLACE FUNCTION public.respond_to_invitation(
  _invitation_id uuid,
  _status text,
  _comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  actor text;
  inv public.event_invitations;
  ev public.events;
  _late boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  IF _status NOT IN ('attending','declined','maybe','pending') THEN
    RAISE EXCEPTION 'Ogiltigt svar.';
  END IF;

  SELECT * INTO inv FROM public.event_invitations WHERE id = _invitation_id FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Kallelsen hittades inte.'; END IF;

  actor := public.invitation_actor_role(_invitation_id);
  IF actor IS NULL THEN RAISE EXCEPTION 'Du har inte behörighet att svara på den här kallelsen.'; END IF;

  IF inv.status = 'revoked' THEN
    RAISE EXCEPTION 'Kallelsen är återkallad och kan inte besvaras.';
  END IF;

  SELECT * INTO ev FROM public.events WHERE id = inv.event_id;
  IF ev.cancelled_at IS NOT NULL THEN
    RAISE EXCEPTION 'Matchen är inställd. Det går inte att lämna nya svar.';
  END IF;
  IF ev.invites_closed_at IS NOT NULL AND actor <> 'coach' THEN
    RAISE EXCEPTION 'Kallelsen är stängd. Kontakta en ledare.';
  END IF;

  _late := inv.respond_by IS NOT NULL AND current_date > inv.respond_by;

  UPDATE public.event_invitations
  SET status = _status,
      comment = COALESCE(_comment, comment),
      responded_by = uid,
      responded_at = now(),
      responded_role = actor
  WHERE id = _invitation_id;

  INSERT INTO public.event_invitation_log
    (invitation_id, team_id, from_status, to_status, changed_by, changed_role)
  VALUES (_invitation_id, inv.team_id, inv.status, _status, uid, actor);

  RETURN jsonb_build_object('status', _status, 'role', actor, 'late', _late,
                            'closed', ev.invites_closed_at IS NOT NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_invitation(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_to_invitation(uuid, text, text) TO authenticated;

-- 7. Återkalla en kallelse
CREATE OR REPLACE FUNCTION public.revoke_invitation(_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  inv public.event_invitations;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  SELECT * INTO inv FROM public.event_invitations WHERE id = _invitation_id FOR UPDATE;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'Kallelsen hittades inte.'; END IF;
  IF NOT public.is_team_coach(inv.team_id, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan återkalla en kallelse.';
  END IF;
  IF inv.status = 'revoked' THEN
    RETURN jsonb_build_object('already', true);
  END IF;

  UPDATE public.event_invitations
  SET status = 'revoked', revoked_at = now(), revoked_by = uid
  WHERE id = _invitation_id;

  INSERT INTO public.event_invitation_log
    (invitation_id, team_id, from_status, to_status, changed_by, changed_role)
  VALUES (_invitation_id, inv.team_id, inv.status, 'revoked', uid, 'coach');

  INSERT INTO public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by)
  SELECT DISTINCT u.user_id, inv.team_id, inv.event_id, 'invite_revoked',
         'Kallelsen är återkallad',
         'Du är inte längre kallad till matchen.', uid
  FROM (
    SELECT p.member_user_id AS user_id FROM public.players p WHERE p.id = inv.player_id
    UNION
    SELECT g.guardian_user_id FROM public.player_guardians g
      WHERE g.player_id = inv.player_id AND g.is_active
  ) u
  WHERE u.user_id IS NOT NULL;

  RETURN jsonb_build_object('already', false);
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_invitation(uuid) TO authenticated;

-- 8. Stäng eller öppna kallelsen
CREATE OR REPLACE FUNCTION public.set_event_invites_closed(_event_id uuid, _closed boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ev public.events;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  SELECT * INTO ev FROM public.events WHERE id = _event_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'Matchen hittades inte.'; END IF;
  IF NOT public.is_team_coach(ev.team_id, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan stänga kallelsen.';
  END IF;

  UPDATE public.events
  SET invites_closed_at = CASE WHEN _closed THEN now() ELSE NULL END
  WHERE id = _event_id;

  RETURN jsonb_build_object('closed', _closed);
END;
$$;
REVOKE ALL ON FUNCTION public.set_event_invites_closed(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_invites_closed(uuid, boolean) TO authenticated;

-- 9. Meddela de kallade om en ändring
CREATE OR REPLACE FUNCTION public.notify_invited_of_change(
  _event_id uuid,
  _title text,
  _body text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ev public.events;
  _sent int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  SELECT * INTO ev FROM public.events WHERE id = _event_id;
  IF ev.id IS NULL THEN RAISE EXCEPTION 'Matchen hittades inte.'; END IF;
  IF NOT public.is_team_coach(ev.team_id, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan meddela de kallade.';
  END IF;

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
  ), ins AS (
    INSERT INTO public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by)
    SELECT user_id, ev.team_id, _event_id, 'event_changed', _title, _body, uid FROM targets
    RETURNING 1
  )
  SELECT count(*) INTO _sent FROM ins;

  RETURN _sent;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_invited_of_change(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_invited_of_change(uuid, text, text) TO authenticated;

-- 10. Påminnelser: en notis per användare, aldrig för inställd eller startad match
DROP FUNCTION IF EXISTS public.send_invite_reminders(uuid, text, text);
CREATE OR REPLACE FUNCTION public.send_invite_reminders(_event_id uuid, _title text, _body text)
RETURNS TABLE(sent integer, skipped_recent integer, missing_account integer, unreachable_players text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF ev.starts_at < now() THEN
    RAISE EXCEPTION 'Matchen har redan börjat. Ingen påminnelse skickas.';
  END IF;
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
         u.user_id
  FROM public.event_invitations i
  JOIN public.players p ON p.id = i.player_id
  LEFT JOIN LATERAL (
    SELECT pl.member_user_id AS user_id FROM public.players pl WHERE pl.id = i.player_id
    UNION
    SELECT g.guardian_user_id FROM public.player_guardians g
      WHERE g.player_id = i.player_id AND g.is_active
  ) u ON true
  WHERE i.event_id = _event_id AND i.status = 'pending';

  SELECT count(DISTINCT invitation_id) INTO _recent
  FROM _targets
  WHERE last_reminder_at IS NOT NULL AND last_reminder_at > now() - interval '5 minutes';

  SELECT count(DISTINCT invitation_id), string_agg(DISTINCT player_name, ', ')
  INTO _missing, _names
  FROM _targets WHERE user_id IS NULL;

  WITH fresh AS (
    SELECT user_id, string_agg(DISTINCT player_name, ' och ') AS names
    FROM _targets
    WHERE user_id IS NOT NULL
      AND (last_reminder_at IS NULL OR last_reminder_at <= now() - interval '5 minutes')
    GROUP BY user_id
  ), ins AS (
    INSERT INTO public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by)
    SELECT user_id, ev.team_id, _event_id, 'invite_reminder', _title,
           _body || ' – gäller ' || names, uid
    FROM fresh
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
$$;
REVOKE ALL ON FUNCTION public.send_invite_reminders(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_invite_reminders(uuid, text, text) TO authenticated;

-- 11. Stoppa nya kallelser till inställd eller spelad match även vid direktinsert
CREATE OR REPLACE FUNCTION public.block_answer_on_cancelled_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ev public.events;
BEGIN
  SELECT * INTO ev FROM public.events e WHERE e.id = NEW.event_id;
  IF TG_OP = 'INSERT' THEN
    IF ev.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Matchen är inställd. Det går inte att kalla fler spelare.';
    END IF;
    IF COALESCE(ev.ends_at, ev.starts_at) < now() THEN
      RAISE EXCEPTION 'Matchen är redan spelad. Det går inte att kalla fler spelare.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.players p WHERE p.id = NEW.player_id AND p.is_active = false) THEN
      RAISE EXCEPTION 'Inaktiva spelare kan inte kallas.';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'revoked' THEN
    IF ev.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Aktiviteten är inställd. Det går inte att lämna nya svar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;