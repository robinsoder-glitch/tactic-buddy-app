-- Hjälpfunktion: är kontot ett avsett vuxenkonto?
CREATE OR REPLACE FUNCTION public.is_adult_account(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.id = _user_id
      AND (pr.is_adult_confirmed OR pr.account_kind IN ('coach', 'guardian'))
  ) OR EXISTS (
    SELECT 1 FROM public.team_members m
    WHERE m.user_id = _user_id
      AND m.team_id = _team_id
      AND m.status = 'approved'
      AND m.role IN ('club_admin', 'head_coach', 'coach', 'guardian')
  )
$$;

REVOKE ALL ON FUNCTION public.is_adult_account(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_adult_account(uuid, uuid) TO authenticated, service_role;

-- R01: kräv godkänt medlemskap i rätt lag för spelare och vårdnadshavare
CREATE OR REPLACE FUNCTION public.invitation_actor_role(_invitation_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Spelaren måste ha ett godkänt medlemskap i kallelsens lag och
  -- spelarkortet måste tillhöra samma lag.
  IF EXISTS (
    SELECT 1
    FROM public.players p
    JOIN public.team_members m
      ON m.team_id = p.team_id AND m.user_id = uid AND m.status = 'approved'
    WHERE p.id = inv.player_id
      AND p.member_user_id = uid
      AND p.team_id = inv.team_id
  ) THEN
    RETURN 'player';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.player_guardians g
    JOIN public.players p ON p.id = g.player_id
    JOIN public.team_members m
      ON m.team_id = p.team_id AND m.user_id = uid AND m.status = 'approved'
    WHERE g.player_id = inv.player_id
      AND g.guardian_user_id = uid
      AND g.is_active
      AND p.team_id = inv.team_id
  ) THEN
    RETURN 'guardian';
  END IF;

  RETURN NULL;
END;
$function$;

-- R03: befintligt medlemskap får inte hoppa över en ny giltig barnkoppling
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
  was_member boolean := false;
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
    -- Behåll det befintliga medlemskapet (t.ex. tränare eller vuxen med
    -- ett barn sedan tidigare) men fortsätt med barnkopplingen nedan.
    was_member := true;
    new_status := existing.status;
  ELSE
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
  END IF;

  IF inv.target_player_id IS NOT NULL AND new_status = 'approved' THEN
    IF wanted = 'guardian' THEN
      IF NOT public.is_adult_account(uid, inv.team_id) THEN
        RAISE EXCEPTION 'Kontot är inte ett vuxenkonto och kan inte kopplas till barnet.';
      END IF;
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

  RETURN QUERY SELECT
    inv.team_id,
    CASE WHEN was_member THEN existing.role ELSE wanted END,
    new_status,
    was_member;
END;
$function$;

-- R04: vuxenkontroll när en vuxen kopplas eller återaktiveras
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

  IF NOT public.is_adult_account(_guardian_user_id, p.team_id) THEN
    RAISE EXCEPTION 'Kontot är inte ett vuxenkonto och kan inte kopplas som vårdnadshavare.';
  END IF;

  INSERT INTO public.player_guardians (player_id, guardian_user_id, relation, is_active, created_by)
  VALUES (_player_id, _guardian_user_id, NULLIF(btrim(COALESCE(_relation, '')), ''), true, uid)
  ON CONFLICT (player_id, guardian_user_id) DO UPDATE
    SET is_active = true,
        relation = COALESCE(EXCLUDED.relation, public.player_guardians.relation),
        updated_at = now();
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_guardian_active(_link_id uuid, _active boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  guardian uuid;
  player uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  SELECT p.team_id, g.guardian_user_id, p.member_user_id INTO tid, guardian, player
  FROM public.player_guardians g JOIN public.players p ON p.id = g.player_id
  WHERE g.id = _link_id;
  IF tid IS NULL THEN RAISE EXCEPTION 'Kopplingen hittades inte.'; END IF;
  IF NOT public.is_team_coach(tid, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan ändra kopplingen.';
  END IF;

  IF _active THEN
    IF guardian = player THEN
      RAISE EXCEPTION 'Spelarens eget konto kan inte vara vårdnadshavare.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members m
      WHERE m.team_id = tid AND m.user_id = guardian AND m.status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Kontot måste vara en godkänd medlem i laget.';
    END IF;
    IF NOT public.is_adult_account(guardian, tid) THEN
      RAISE EXCEPTION 'Kontot är inte ett vuxenkonto och kan inte återaktiveras som vårdnadshavare.';
    END IF;
  END IF;

  UPDATE public.player_guardians SET is_active = _active, updated_at = now() WHERE id = _link_id;
END;
$function$;