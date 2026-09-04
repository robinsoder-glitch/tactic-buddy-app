-- 1. accept_team_invite: lås inbjudan, validera spelarkort mot laget och mot upptagen koppling
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
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  -- Lås raden så att två samtidiga accepteranden inte båda hinner igenom.
  SELECT * INTO inv FROM public.team_invites WHERE token = _token FOR UPDATE;
  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'Länken är ogiltig.';
  END IF;
  IF inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Länken har återkallats.';
  END IF;
  IF inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Länken har redan använts.';
  END IF;
  IF inv.expires_at <= now() THEN
    RAISE EXCEPTION 'Länken har gått ut.';
  END IF;

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

  -- Spelarkortet måste tillhöra samma lag som inbjudan.
  IF inv.target_player_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = inv.target_player_id AND p.team_id = inv.team_id
  ) THEN
    RAISE EXCEPTION 'Spelarkortet tillhör inte laget.';
  END IF;

  -- Ett spelarkort som redan är kopplat till ett annat konto får inte tas över.
  IF inv.target_player_id IS NOT NULL AND wanted = 'player' AND EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = inv.target_player_id
      AND p.member_user_id IS NOT NULL
      AND p.member_user_id <> uid
  ) THEN
    RAISE EXCEPTION 'Spelarkortet är redan kopplat till ett annat konto. Kontakta lagets tränare.';
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

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, (CASE WHEN wanted = 'coach' THEN 'coach' ELSE 'player' END)::public.app_role)
  ON CONFLICT DO NOTHING;

  IF inv.target_player_id IS NOT NULL AND new_status = 'approved' THEN
    IF wanted = 'guardian' THEN
      INSERT INTO public.player_guardians (player_id, guardian_user_id, created_by, is_active)
      VALUES (inv.target_player_id, uid, inv.created_by, true)
      ON CONFLICT (player_id, guardian_user_id) DO UPDATE SET is_active = true;
    ELSIF wanted = 'player' THEN
      UPDATE public.players SET member_user_id = uid
      WHERE id = inv.target_player_id AND team_id = inv.team_id
        AND (member_user_id IS NULL OR member_user_id = uid);
    END IF;
  END IF;

  UPDATE public.team_invites
  SET accepted_at = now(), accepted_by = uid
  WHERE id = inv.id AND accepted_at IS NULL;

  RETURN QUERY SELECT inv.team_id, wanted, new_status, false;
END;
$function$;

-- 2. Säker serverfunktion för att koppla vårdnadshavare
CREATE OR REPLACE FUNCTION public.link_guardian(_player_id uuid, _guardian_user_id uuid, _relation text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  p public.players;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;

  SELECT * INTO p FROM public.players WHERE id = _player_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Spelaren hittades inte.'; END IF;
  IF p.team_id IS NULL THEN RAISE EXCEPTION 'Spelaren tillhör inget lag.'; END IF;

  IF NOT public.is_team_coach(p.team_id, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan koppla vårdnadshavare.';
  END IF;

  -- Vårdnadshavaren måste vara en godkänd medlem i samma lag – väntande
  -- spelarkonton och konton utanför laget godkänns inte.
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members m
    WHERE m.team_id = p.team_id
      AND m.user_id = _guardian_user_id
      AND m.status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Kontot måste vara en godkänd medlem i laget innan det kan kopplas.';
  END IF;

  IF p.member_user_id = _guardian_user_id THEN
    RAISE EXCEPTION 'Spelarens eget konto kan inte kopplas som vårdnadshavare.';
  END IF;

  INSERT INTO public.player_guardians (player_id, guardian_user_id, relation, is_active, created_by)
  VALUES (_player_id, _guardian_user_id, NULLIF(btrim(COALESCE(_relation, '')), ''), true, uid)
  ON CONFLICT (player_id, guardian_user_id) DO UPDATE
    SET is_active = true,
        relation = COALESCE(EXCLUDED.relation, public.player_guardians.relation),
        updated_at = now();
END;
$function$;

-- Direktregistrering av kopplingar stängs – det går bara via link_guardian
-- eller via accept_team_invite (båda säkerhetsdefinierade).
DROP POLICY "Coaches manage guardian links" ON public.player_guardians;

-- 3. publish_event_invitations: återaktivera återkallade kallelser kontrollerat,
--    notis bara till spelare som faktiskt läggs till (skydd mot dubbelklick/återförsök)
CREATE OR REPLACE FUNCTION public.publish_event_invitations(_event_id uuid, _player_ids uuid[], _message text, _respond_by date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  CREATE TEMP TABLE _newly_added ON COMMIT DROP AS
  WITH ins AS (
    INSERT INTO public.event_invitations
      (event_id, team_id, player_id, message, respond_by, created_by)
    SELECT _event_id, ev.team_id, pid, _message, _respond_by, uid
    FROM unnest(_player_ids) pid
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

  SELECT count(*) INTO _added FROM _newly_added;

  -- Historik för återaktiverade kallelser
  INSERT INTO public.event_invitation_log (invitation_id, team_id, from_status, to_status, changed_by, changed_role)
  SELECT id, ev.team_id, 'revoked', 'pending', uid, 'coach'
  FROM _newly_added WHERE NOT was_insert;

  -- Notis bara till spelare som faktiskt lades till eller återaktiverades.
  INSERT INTO public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by, dedupe_key)
  SELECT DISTINCT u.user_id, ev.team_id, _event_id, 'invite_published',
         'Ny kallelse',
         COALESCE(NULLIF(_message, ''), 'Du har fått en kallelse till en match.'),
         uid,
         'invite_published:' || _event_id::text || ':' || u.user_id::text
  FROM _newly_added na
  CROSS JOIN LATERAL (
    SELECT p.member_user_id AS user_id FROM public.players p WHERE p.id = na.player_id
    UNION
    SELECT g.guardian_user_id FROM public.player_guardians g
      WHERE g.player_id = na.player_id AND g.is_active
  ) u
  WHERE u.user_id IS NOT NULL
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;

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
$function$;

-- Unikt skydd mot dubblettnotiser
CREATE UNIQUE INDEX IF NOT EXISTS app_notifications_dedupe_key_uidx
  ON public.app_notifications (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- 4. update_invitation_details: dubblettskydd för ändringsnotiser inom samma minut
CREATE OR REPLACE FUNCTION public.update_invitation_details(_event_id uuid, _message text, _respond_by date, _notify boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
      INSERT INTO public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by, dedupe_key)
      SELECT user_id, ev.team_id, _event_id, 'invite_updated', 'Kallelsen har ändrats',
             COALESCE(NULLIF(_message, ''), 'Informationen i kallelsen har uppdaterats.'), uid,
             'invite_updated:' || _event_id::text || ':' || user_id::text || ':' || to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI')
      FROM targets
      ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
      RETURNING 1
    )
    SELECT count(*) INTO _notified FROM ins;
  END IF;

  RETURN jsonb_build_object('updated', _updated, 'notified', _notified);
END;
$function$;

-- 5. Stäng direkta klientskrivningar till kallelser och kallelsehistorik.
--    Läsning för tränare/admin ersätter den tidigare fulla åtkomsten;
--    allt sparande går via de säkerhetsdefinierade funktionerna.
DROP POLICY "Coaches manage team invitations" ON public.event_invitations;
CREATE POLICY "Coaches read team invitations" ON public.event_invitations
  FOR SELECT TO authenticated
  USING (is_team_coach(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Members write invitation log" ON public.event_invitation_log;