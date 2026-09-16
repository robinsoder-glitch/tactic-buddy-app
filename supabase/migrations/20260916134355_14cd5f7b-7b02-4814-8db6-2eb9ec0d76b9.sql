CREATE OR REPLACE FUNCTION public.leave_team(_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.teams;
  roles text[];
  is_leader boolean;
  other_leaders int;
  left_player_ids uuid[];
  cleared_players int := 0;
  cleared_guardians int := 0;
  revoked_invites int := 0;
  notified int := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT * INTO t FROM public.teams WHERE id = _team_id FOR UPDATE;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Laget hittades inte.';
  END IF;

  SELECT array_agg(role) INTO roles
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = uid;

  IF roles IS NULL THEN
    RAISE EXCEPTION 'Du är inte med i laget.';
  END IF;

  is_leader := roles && ARRAY['coach', 'head_coach', 'club_admin'];

  IF t.created_by = uid THEN
    RAISE EXCEPTION 'Du har skapat laget och kan inte lämna det. Radera laget i stället.';
  END IF;

  IF is_leader THEN
    SELECT count(*) INTO other_leaders
    FROM public.team_members
    WHERE team_id = _team_id
      AND user_id <> uid
      AND status = 'approved'
      AND role IN ('coach', 'head_coach', 'club_admin');
    IF other_leaders = 0 THEN
      RAISE EXCEPTION 'Du är lagets enda ledare. Bjud in en ny ledare innan du lämnar laget.';
    END IF;
  END IF;

  SELECT coalesce(array_agg(id), '{}'::uuid[]) INTO left_player_ids
  FROM public.players
  WHERE team_id = _team_id AND member_user_id = uid;

  UPDATE public.players
  SET member_user_id = NULL, is_active = false, left_at = now()
  WHERE id = ANY(left_player_ids);
  GET DIAGNOSTICS cleared_players = ROW_COUNT;

  UPDATE public.player_guardians g
  SET is_active = false
  FROM public.players p
  WHERE g.player_id = p.id
    AND p.team_id = _team_id
    AND g.guardian_user_id = uid
    AND g.is_active;
  GET DIAGNOSTICS cleared_guardians = ROW_COUNT;

  IF coalesce(array_length(left_player_ids, 1), 0) > 0 THEN
    UPDATE public.event_invitations i
    SET status = 'revoked', revoked_at = now(), revoked_by = uid, updated_at = now()
    FROM public.events e
    WHERE i.event_id = e.id
      AND i.team_id = _team_id
      AND i.player_id = ANY(left_player_ids)
      AND i.status = 'pending'
      AND e.starts_at >= now();
    GET DIAGNOSTICS revoked_invites = ROW_COUNT;

    DELETE FROM public.event_squad s
    USING public.events e
    WHERE s.event_id = e.id
      AND s.team_id = _team_id
      AND s.player_id = ANY(left_player_ids)
      AND e.starts_at >= now();
  END IF;

  DELETE FROM public.team_members WHERE team_id = _team_id AND user_id = uid;
  DELETE FROM public.event_coaches WHERE team_id = _team_id AND user_id = uid;

  INSERT INTO public.app_notifications (user_id, team_id, kind, title, body, created_by, priority)
  SELECT m.user_id, _team_id, 'member_left',
         'Någon har lämnat laget',
         coalesce(nullif(btrim(pr.display_name), ''), 'En medlem')
           || ' har lämnat ' || t.name
           || CASE WHEN cleared_players > 0
                THEN '. Spelaren finns kvar under Lämnade spelare.'
                ELSE '.' END,
         uid,
         'normal'
  FROM public.team_members m
  LEFT JOIN public.profiles pr ON pr.id = uid
  WHERE m.team_id = _team_id
    AND m.status = 'approved'
    AND m.role IN ('coach', 'head_coach', 'club_admin');
  GET DIAGNOSTICS notified = ROW_COUNT;

  RETURN jsonb_build_object(
    'team_name', t.name,
    'cleared_players', cleared_players,
    'cleared_guardian_links', cleared_guardians,
    'revoked_invitations', revoked_invites,
    'notified_leaders', notified
  );
END;
$$;

REVOKE ALL ON FUNCTION public.leave_team(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.leave_team(uuid) TO authenticated;