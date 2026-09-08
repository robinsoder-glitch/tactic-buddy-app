CREATE OR REPLACE FUNCTION public.accept_team_invite(_token text, _account_kind text DEFAULT NULL::text)
 RETURNS TABLE(team_id uuid, member_role text, member_status text, already_member boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
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

  -- Vuxenkontrollen görs innan något medlemskap skapas, så att den roll som
  -- skapas här aldrig kan kvalificera kontot åt sig själv.
  IF wanted = 'guardian' AND inv.target_player_id IS NOT NULL THEN
    IF NOT public.is_adult_account(uid, inv.team_id) THEN
      RAISE EXCEPTION 'Kontot är inte ett vuxenkonto och kan inte kopplas till barnet.';
    END IF;
  END IF;

  IF inv.target_player_id IS NOT NULL THEN
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

REVOKE ALL ON FUNCTION public.accept_team_invite(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text, text) TO authenticated, service_role;