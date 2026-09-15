CREATE OR REPLACE FUNCTION public.start_session_run(_session_id uuid, _event_id uuid DEFAULT NULL)
RETURNS public.session_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session public.coach_sessions%ROWTYPE;
  _event public.events%ROWTYPE;
  _run public.session_runs%ROWTYPE;
  _count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT * INTO _session FROM public.coach_sessions WHERE id = _session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Träningspasset kunde inte hittas.';
  END IF;

  IF _session.user_id <> auth.uid()
     AND NOT (_session.team_id IS NOT NULL AND public.is_team_coach(_session.team_id, auth.uid())) THEN
    RAISE EXCEPTION 'Du har inte behörighet till det här träningspasset.';
  END IF;

  IF _event_id IS NOT NULL THEN
    SELECT * INTO _event FROM public.events WHERE id = _event_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Aktiviteten kunde inte hittas.';
    END IF;
    IF _session.team_id IS NULL OR _event.team_id IS DISTINCT FROM _session.team_id THEN
      RAISE EXCEPTION 'Aktiviteten hör till ett annat lag än träningspasset.';
    END IF;
    IF NOT public.is_team_coach(_event.team_id, auth.uid()) THEN
      RAISE EXCEPTION 'Du har inte behörighet till den här aktiviteten.';
    END IF;
    IF _event.cancelled_at IS NOT NULL THEN
      RAISE EXCEPTION 'Aktiviteten är inställd.';
    END IF;
  END IF;

  -- Låset gör att två samtidiga starter inte kan skapa varsitt genomförande.
  PERFORM pg_advisory_xact_lock(hashtext('session_run:' || _session_id::text));

  SELECT * INTO _run FROM public.session_runs
  WHERE session_id = _session_id AND status = 'active'
  ORDER BY started_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN _run;
  END IF;

  SELECT count(*) INTO _count FROM public.coach_session_items WHERE session_id = _session_id;
  IF _count = 0 THEN
    RAISE EXCEPTION 'Passet saknar innehåll. Lägg till minst en del innan du startar.';
  END IF;

  INSERT INTO public.session_runs (session_id, team_id, event_id, coach_id)
  VALUES (_session_id, _session.team_id, _event_id, auth.uid())
  RETURNING * INTO _run;

  INSERT INTO public.session_run_items
    (run_id, item_id, kind, title, resource_id, planned_minutes, sort_order)
  SELECT _run.id, i.id, i.kind, i.title, i.resource_id, i.minutes,
         row_number() OVER (ORDER BY i.sort_order, i.created_at) - 1
  FROM public.coach_session_items i
  WHERE i.session_id = _session_id;

  RETURN _run;
END;
$$;

REVOKE ALL ON FUNCTION public.start_session_run(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_session_run(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.finish_session_run(
  _run_id uuid,
  _last_item_id uuid DEFAULT NULL,
  _last_seconds integer DEFAULT NULL,
  _general_note text DEFAULT NULL
)
RETURNS SETOF public.session_run_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _run public.session_runs%ROWTYPE;
  _pause integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT * INTO _run FROM public.session_runs WHERE id = _run_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Genomförandet kunde inte hittas.';
  END IF;

  IF _run.coach_id <> auth.uid()
     AND NOT (_run.team_id IS NOT NULL AND public.is_team_coach(_run.team_id, auth.uid())) THEN
    RAISE EXCEPTION 'Du har inte behörighet till det här genomförandet.';
  END IF;

  -- Upprepat avslut ska inte flytta sluttiden eller skriva över rättad närvaro.
  IF _run.status <> 'active' THEN
    RETURN QUERY SELECT * FROM public.session_run_items WHERE run_id = _run_id ORDER BY sort_order;
    RETURN;
  END IF;

  IF _last_item_id IS NOT NULL THEN
    UPDATE public.session_run_items
    SET actual_seconds = COALESCE(_last_seconds, actual_seconds), status = 'done'
    WHERE id = _last_item_id AND run_id = _run_id AND status = 'pending';
  END IF;

  IF _general_note IS NOT NULL THEN
    UPDATE public.session_runs SET general_note = _general_note WHERE id = _run_id;
  END IF;

  -- Närvaron speglas till lagets aktivitet i samma steg som passet avslutas.
  IF _run.event_id IS NOT NULL AND _run.team_id IS NOT NULL THEN
    INSERT INTO public.event_attendance
      (event_id, team_id, player_id, status, created_by, registered_by, updated_by)
    SELECT _run.event_id, _run.team_id, a.player_id, a.status, auth.uid(), auth.uid(), auth.uid()
    FROM public.session_run_attendance a
    WHERE a.run_id = _run_id
    ON CONFLICT (event_id, player_id) DO UPDATE
      SET status = EXCLUDED.status, updated_by = EXCLUDED.updated_by, updated_at = now();
  END IF;

  UPDATE public.coach_sessions SET status = 'done' WHERE id = _run.session_id;

  -- En pågående paus räknas med så att aktiv tid inte hoppar upp vid avslut.
  _pause := CASE
    WHEN _run.paused_at IS NOT NULL
      THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - _run.paused_at)))::integer)
    ELSE 0
  END;

  UPDATE public.session_runs
  SET status = 'done',
      ended_at = now(),
      paused_at = NULL,
      paused_seconds = COALESCE(paused_seconds, 0) + _pause
  WHERE id = _run_id;

  RETURN QUERY SELECT * FROM public.session_run_items WHERE run_id = _run_id ORDER BY sort_order;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_session_run(uuid, uuid, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_session_run(uuid, uuid, integer, text) TO authenticated;