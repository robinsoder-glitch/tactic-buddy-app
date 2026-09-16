CREATE OR REPLACE FUNCTION public.leave_team(_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  t public.teams;
  roles text[];
  is_leader boolean;
  other_leaders int;
  cleared_players int := 0;
  cleared_guardians int := 0;
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

  -- Spelarkortet ska inte ligga kvar i truppen när spelaren lämnar laget.
  UPDATE public.players
  SET member_user_id = NULL, is_active = false
  WHERE team_id = _team_id AND member_user_id = uid;
  GET DIAGNOSTICS cleared_players = ROW_COUNT;

  UPDATE public.player_guardians g
  SET is_active = false
  FROM public.players p
  WHERE g.player_id = p.id
    AND p.team_id = _team_id
    AND g.guardian_user_id = uid
    AND g.is_active;
  GET DIAGNOSTICS cleared_guardians = ROW_COUNT;

  DELETE FROM public.team_members WHERE team_id = _team_id AND user_id = uid;
  DELETE FROM public.event_coaches WHERE team_id = _team_id AND user_id = uid;

  INSERT INTO public.app_notifications (user_id, team_id, kind, title, body, created_by, priority)
  SELECT m.user_id, _team_id, 'member_left',
         'Någon har lämnat laget',
         coalesce(nullif(btrim(pr.display_name), ''), 'En medlem')
           || ' har lämnat ' || t.name
           || CASE WHEN cleared_players > 0
                THEN '. Spelarkortet är avaktiverat – kontrollera truppen.'
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
    'notified_leaders', notified
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.leave_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_team(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_own_team(_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  t public.teams;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT * INTO t FROM public.teams WHERE id = _team_id FOR UPDATE;
  IF t.id IS NULL THEN
    RAISE EXCEPTION 'Laget hittades inte.';
  END IF;

  IF t.created_by <> uid AND NOT public.is_platform_admin(uid) THEN
    RAISE EXCEPTION 'Bara tränaren som skapade laget kan radera det.';
  END IF;

  DELETE FROM public.event_attendance WHERE team_id = _team_id;
  DELETE FROM public.event_coaches WHERE team_id = _team_id;
  DELETE FROM public.event_invitation_log WHERE team_id = _team_id;
  DELETE FROM public.event_invitations WHERE team_id = _team_id;
  DELETE FROM public.event_messages WHERE team_id = _team_id;
  DELETE FROM public.event_plans WHERE team_id = _team_id;
  DELETE FROM public.event_resources WHERE team_id = _team_id;
  DELETE FROM public.event_squad WHERE team_id = _team_id;
  DELETE FROM public.event_change_log WHERE team_id = _team_id;
  DELETE FROM public.match_lineups WHERE team_id = _team_id;
  DELETE FROM public.match_shares WHERE team_id = _team_id;

  DELETE FROM public.announcement_recipients ar
  USING public.team_announcements ta
  WHERE ar.announcement_id = ta.id AND ta.team_id = _team_id;
  DELETE FROM public.team_announcements WHERE team_id = _team_id;

  DELETE FROM public.session_run_attendance sra
  USING public.session_runs sr
  WHERE sra.run_id = sr.id AND sr.team_id = _team_id;
  DELETE FROM public.session_run_items sri
  USING public.session_runs sr
  WHERE sri.run_id = sr.id AND sr.team_id = _team_id;
  DELETE FROM public.session_run_player_notes srn
  USING public.session_runs sr
  WHERE srn.run_id = sr.id AND sr.team_id = _team_id;
  DELETE FROM public.session_runs WHERE team_id = _team_id;

  DELETE FROM public.period_links pl
  USING public.team_periods tp
  WHERE pl.period_id = tp.id AND tp.team_id = _team_id;
  DELETE FROM public.period_progression pp
  USING public.team_periods tp
  WHERE pp.period_id = tp.id AND tp.team_id = _team_id;

  DELETE FROM public.player_observations WHERE team_id = _team_id;
  DELETE FROM public.player_focus_areas WHERE team_id = _team_id;
  DELETE FROM public.team_periods WHERE team_id = _team_id;
  DELETE FROM public.player_stats WHERE team_id = _team_id;
  DELETE FROM public.player_guardians g
  USING public.players p
  WHERE g.player_id = p.id AND p.team_id = _team_id;

  DELETE FROM public.team_chat_messages WHERE team_id = _team_id;
  DELETE FROM public.team_chat_reads WHERE team_id = _team_id;
  DELETE FROM public.team_photos WHERE team_id = _team_id;
  DELETE FROM public.team_invites WHERE team_id = _team_id;
  DELETE FROM public.team_join_codes WHERE team_id = _team_id;
  DELETE FROM public.app_notifications WHERE team_id = _team_id;

  UPDATE public.coach_sessions SET team_id = NULL WHERE team_id = _team_id;
  UPDATE public.coach_drills SET team_id = NULL WHERE team_id = _team_id;
  UPDATE public.tactics SET team_id = NULL WHERE team_id = _team_id;

  DELETE FROM public.events WHERE team_id = _team_id;
  DELETE FROM public.players WHERE team_id = _team_id;
  DELETE FROM public.team_members WHERE team_id = _team_id;
  DELETE FROM public.teams WHERE id = _team_id;

  RETURN jsonb_build_object('team_name', t.name, 'deleted', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_own_team(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_team(uuid) TO authenticated;