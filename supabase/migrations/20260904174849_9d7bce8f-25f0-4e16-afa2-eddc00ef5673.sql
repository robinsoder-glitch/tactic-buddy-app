DROP FUNCTION IF EXISTS public.approve_team_join_request(uuid);

CREATE OR REPLACE FUNCTION public.approve_team_join_request(
  _member_id uuid,
  _player_id uuid DEFAULT NULL
)
RETURNS TABLE(member_role text, linked_player_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  m public.team_members;
  p public.players;
  target uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT * INTO m FROM public.team_members WHERE id = _member_id FOR UPDATE;
  IF m.id IS NULL THEN
    RAISE EXCEPTION 'Ansökan hittades inte.';
  END IF;

  IF NOT public.is_team_coach(m.team_id, uid) AND NOT public.is_platform_admin(uid) THEN
    RAISE EXCEPTION 'Endast lagets tränare kan godkänna ansökningar.';
  END IF;

  IF m.status <> 'pending' THEN
    RAISE EXCEPTION 'Ansökan är redan behandlad.';
  END IF;

  IF m.role IN ('player', 'guardian') THEN
    IF _player_id IS NULL THEN
      RAISE EXCEPTION 'Välj vilket spelarkort personen hör till.';
    END IF;

    SELECT * INTO p FROM public.players WHERE id = _player_id FOR UPDATE;
    IF p.id IS NULL OR p.team_id IS DISTINCT FROM m.team_id THEN
      RAISE EXCEPTION 'Spelarkortet hör inte till det här laget.';
    END IF;

    IF m.role = 'player' THEN
      IF p.member_user_id IS NOT NULL AND p.member_user_id <> m.user_id THEN
        RAISE EXCEPTION 'Spelarkortet är redan kopplat till ett annat konto.';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.players other
        WHERE other.team_id = m.team_id
          AND other.member_user_id = m.user_id
          AND other.id <> p.id
      ) THEN
        RAISE EXCEPTION 'Kontot är redan kopplat till ett annat spelarkort i laget.';
      END IF;
      UPDATE public.players SET member_user_id = m.user_id WHERE id = p.id;
    ELSE
      IF EXISTS (
        SELECT 1 FROM public.player_guardians g
        WHERE g.player_id = p.id AND g.guardian_user_id = m.user_id AND g.is_active
      ) THEN
        RAISE EXCEPTION 'Personen är redan vårdnadshavare för spelaren.';
      END IF;
      INSERT INTO public.player_guardians (player_id, guardian_user_id, created_by, is_active)
      VALUES (p.id, m.user_id, uid, true)
      ON CONFLICT (player_id, guardian_user_id) DO UPDATE SET is_active = true;
    END IF;

    target := p.id;
  ELSIF _player_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ledare kopplas inte till ett spelarkort.';
  END IF;

  UPDATE public.team_members SET status = 'approved' WHERE id = m.id;

  INSERT INTO public.app_notifications (user_id, team_id, kind, title, body, created_by)
  SELECT m.user_id, m.team_id, 'membership_approved',
         'Du är med i laget',
         'Din ansökan till ' || t.name || ' är godkänd.',
         uid
  FROM public.teams t WHERE t.id = m.team_id;

  RETURN QUERY SELECT m.role, target;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_team_join_request(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_team_join_request(uuid, uuid) TO authenticated, service_role;