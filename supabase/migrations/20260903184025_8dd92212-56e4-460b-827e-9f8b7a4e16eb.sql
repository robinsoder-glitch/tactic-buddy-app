-- 1. team_invites: personliga länkar
ALTER TABLE public.team_invites ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.team_invites
  ADD COLUMN IF NOT EXISTS invite_kind text NOT NULL DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS target_player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recipient_label text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'team_invites_kind_chk') THEN
    ALTER TABLE public.team_invites
      ADD CONSTRAINT team_invites_kind_chk CHECK (invite_kind IN ('email','link'));
  END IF;
END $$;

-- 2. Hur medlemmen kom in
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS joined_via text;

-- 3. Kodanslutning noterar källan
CREATE OR REPLACE FUNCTION public.join_team_with_code(_code text, _account_kind text)
 RETURNS TABLE(team_id uuid, team_name text, member_role text, member_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  norm text := upper(btrim(COALESCE(_code, '')));
  t public.teams;
  code_kind text;
  expected_kind text;
  existing public.team_members;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  IF _account_kind IS NULL OR _account_kind NOT IN ('coach', 'player', 'guardian') THEN
    RAISE EXCEPTION 'Ogiltig kontotyp.';
  END IF;

  IF length(norm) <> 6 THEN
    RAISE EXCEPTION 'Lagkoden ska vara exakt sex tecken.';
  END IF;

  SELECT * INTO t FROM public.teams
  WHERE join_code = norm OR coach_join_code = norm
  LIMIT 1;

  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Koden stämmer inte. Kontrollera de sex tecknen med din tränare.';
  END IF;

  IF t.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Laget är arkiverat. Be din tränare om en ny kod.';
  END IF;

  code_kind := CASE WHEN t.coach_join_code = norm THEN 'coach' ELSE 'player' END;
  expected_kind := CASE WHEN _account_kind = 'coach' THEN 'coach' ELSE 'player' END;

  IF code_kind <> expected_kind THEN
    IF expected_kind = 'coach' THEN
      RAISE EXCEPTION 'Den koden är en spelarkod. Som tränare behöver du lagets tränarkod.';
    ELSE
      RAISE EXCEPTION 'Den koden är en tränarkod. Som spelare eller vårdnadshavare behöver du lagets spelarkod.';
    END IF;
  END IF;

  SELECT * INTO existing FROM public.team_members m
  WHERE m.team_id = t.id AND m.user_id = uid;

  IF existing.id IS NOT NULL THEN
    RETURN QUERY SELECT t.id, t.name, existing.role, existing.status;
    RETURN;
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role, status, joined_via)
  VALUES (t.id, uid, _account_kind, 'pending',
          CASE WHEN code_kind = 'coach' THEN 'coach_code' ELSE 'player_code' END);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (uid, (CASE WHEN _account_kind = 'coach' THEN 'coach' ELSE 'player' END)::public.app_role)
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT t.id, t.name, _account_kind, 'pending'::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.join_team_with_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_team_with_code(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_team_with_code(text, text) TO service_role;

-- 4. Säker förhandsvisning av personlig inbjudan
CREATE OR REPLACE FUNCTION public.preview_team_invite(_token text)
RETURNS TABLE(
  state text,
  team_name text,
  club_name text,
  age_group text,
  invite_role text,
  expires_at timestamptz,
  email_locked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv public.team_invites;
  t public.teams;
  st text;
BEGIN
  SELECT * INTO inv FROM public.team_invites WHERE token = _token LIMIT 1;

  IF inv.id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz, false;
    RETURN;
  END IF;

  SELECT * INTO t FROM public.teams WHERE id = inv.team_id;

  st := CASE
    WHEN inv.revoked_at IS NOT NULL THEN 'revoked'
    WHEN inv.accepted_at IS NOT NULL THEN 'used'
    WHEN inv.expires_at <= now() THEN 'expired'
    WHEN t.archived_at IS NOT NULL THEN 'archived'
    ELSE 'active'
  END;

  RETURN QUERY SELECT st, t.name, t.club_name, t.age_group, inv.role::text, inv.expires_at,
                      (inv.email IS NOT NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.preview_team_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_team_invite(text) TO anon, authenticated, service_role;

-- 5. Acceptera personlig inbjudan
DROP FUNCTION IF EXISTS public.accept_team_invite(text);

CREATE OR REPLACE FUNCTION public.accept_team_invite(_token text, _account_kind text DEFAULT NULL)
RETURNS TABLE(team_id uuid, member_role text, member_status text, already_member boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  SELECT * INTO inv FROM public.team_invites WHERE token = _token LIMIT 1;
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

  SELECT * INTO existing FROM public.team_members m
  WHERE m.team_id = inv.team_id AND m.user_id = uid;

  IF existing.id IS NOT NULL AND existing.status = 'approved' THEN
    RETURN QUERY SELECT inv.team_id, existing.role, existing.status, true;
    RETURN;
  END IF;

  -- Personlig länk utan e-post och utan spelarkort blir väntande.
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
      WHERE id = inv.target_player_id AND member_user_id IS NULL;
    END IF;
  END IF;

  UPDATE public.team_invites
  SET accepted_at = now(), accepted_by = uid
  WHERE id = inv.id AND accepted_at IS NULL;

  RETURN QUERY SELECT inv.team_id, wanted, new_status, false;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_team_invite(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text, text) TO service_role;

-- 6. Atomiskt godkännande av ansökan med koppling till spelarkort
CREATE OR REPLACE FUNCTION public.approve_team_join_request(_member_id uuid)
RETURNS TABLE(member_role text, linked_player_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  m public.team_members;
  child_name text;
  own_name text;
  target uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT * INTO m FROM public.team_members WHERE id = _member_id;
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'Ansökan hittades inte.';
  END IF;

  IF NOT public.is_team_coach(m.team_id, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets tränare kan godkänna ansökningar.';
  END IF;

  UPDATE public.team_members SET status = 'approved' WHERE id = m.id;

  SELECT display_name, guardian_for_name INTO own_name, child_name
  FROM public.profiles WHERE id = m.user_id;

  IF m.role = 'player' THEN
    SELECT p.id INTO target FROM public.players p
    WHERE p.team_id = m.team_id AND p.member_user_id IS NULL
      AND own_name IS NOT NULL AND lower(btrim(p.name)) = lower(btrim(own_name))
    LIMIT 1;
    IF target IS NOT NULL THEN
      UPDATE public.players SET member_user_id = m.user_id WHERE id = target;
    END IF;
  ELSIF m.role = 'guardian' THEN
    SELECT p.id INTO target FROM public.players p
    WHERE p.team_id = m.team_id
      AND child_name IS NOT NULL AND lower(btrim(p.name)) = lower(btrim(child_name))
    LIMIT 1;
    IF target IS NOT NULL THEN
      INSERT INTO public.player_guardians (player_id, guardian_user_id, created_by, is_active)
      VALUES (target, m.user_id, uid, true)
      ON CONFLICT (player_id, guardian_user_id) DO UPDATE SET is_active = true;
    END IF;
  END IF;

  INSERT INTO public.app_notifications (user_id, team_id, kind, title, body, created_by)
  SELECT m.user_id, m.team_id, 'membership_approved',
         'Du är med i laget',
         'Din ansökan till ' || t.name || ' är godkänd.',
         uid
  FROM public.teams t WHERE t.id = m.team_id;

  RETURN QUERY SELECT m.role, target;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_team_join_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_team_join_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_team_join_request(uuid) TO service_role;