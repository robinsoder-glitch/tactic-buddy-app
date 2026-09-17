ALTER TABLE public.coach_sessions
  ADD COLUMN focus_areas text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.coach_drills
  ADD COLUMN guide jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.coach_session_items
  ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.event_resources
  ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.save_training_plan(_event_id uuid, _team_id uuid, _notes text, _items jsonb)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;
  IF NOT public.is_team_coach(_team_id, uid) THEN
    RAISE EXCEPTION 'Endast lagets tränare kan spara planeringen.';
  END IF;

  DELETE FROM public.event_resources
  WHERE event_id = _event_id AND kind IN ('drill', 'goalkeeper', 'session');

  INSERT INTO public.event_resources (event_id, team_id, created_by, kind, resource_id, minutes, note, sort_order, details)
  SELECT _event_id,
         _team_id,
         uid,
         CASE WHEN COALESCE(item->>'kind', 'drill') IN ('drill', 'goalkeeper', 'session')
              THEN item->>'kind' ELSE 'drill' END,
         item->>'resource_id',
         NULLIF(item->>'minutes', '')::int,
         NULLIF(btrim(COALESCE(item->>'note', '')), ''),
         (ord - 1)::int,
         COALESCE(item->'details', '{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) WITH ORDINALITY AS t(item, ord);

  INSERT INTO public.event_plans (event_id, team_id, created_by, notes, planning_done)
  VALUES (_event_id, _team_id, uid, NULLIF(btrim(COALESCE(_notes, '')), ''), jsonb_array_length(COALESCE(_items, '[]'::jsonb)) > 0)
  ON CONFLICT (event_id) DO UPDATE
    SET notes = EXCLUDED.notes,
        planning_done = EXCLUDED.planning_done;
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_session_run(_session_id uuid, _event_id uuid DEFAULT NULL::uuid)
RETURNS session_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _session public.coach_sessions%ROWTYPE;
  _event public.events%ROWTYPE;
  _run public.session_runs%ROWTYPE;
  _count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  SELECT * INTO _session FROM public.coach_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Träningspasset kunde inte hittas.'; END IF;
  IF _session.user_id <> auth.uid()
     AND NOT (_session.team_id IS NOT NULL AND public.is_team_coach(_session.team_id, auth.uid())) THEN
    RAISE EXCEPTION 'Du har inte behörighet till det här träningspasset.';
  END IF;
  IF _event_id IS NOT NULL THEN
    SELECT * INTO _event FROM public.events WHERE id = _event_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Aktiviteten kunde inte hittas.'; END IF;
    IF _session.team_id IS NULL OR _event.team_id IS DISTINCT FROM _session.team_id THEN
      RAISE EXCEPTION 'Aktiviteten hör till ett annat lag än träningspasset.';
    END IF;
    IF NOT public.is_team_coach(_event.team_id, auth.uid()) THEN
      RAISE EXCEPTION 'Du har inte behörighet till den här aktiviteten.';
    END IF;
    IF _event.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'Aktiviteten är inställd.'; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('session_run:' || _session_id::text));
  SELECT * INTO _run FROM public.session_runs
  WHERE session_id = _session_id AND status = 'active'
  ORDER BY started_at DESC LIMIT 1;
  IF FOUND THEN RETURN _run; END IF;
  SELECT count(*) INTO _count FROM public.coach_session_items WHERE session_id = _session_id;
  IF _count = 0 THEN RAISE EXCEPTION 'Passet saknar innehåll. Lägg till minst en del innan du startar.'; END IF;
  INSERT INTO public.session_runs (session_id, team_id, event_id, coach_id)
  VALUES (_session_id, _session.team_id, _event_id, auth.uid()) RETURNING * INTO _run;
  INSERT INTO public.session_run_items
    (run_id, item_id, kind, title, resource_id, planned_minutes, sort_order, details)
  SELECT _run.id, i.id, i.kind, i.title, i.resource_id, i.minutes,
         row_number() OVER (ORDER BY i.sort_order, i.created_at) - 1, i.details
  FROM public.coach_session_items i WHERE i.session_id = _session_id;
  RETURN _run;
END;
$function$;

ALTER TABLE public.session_run_items
  ADD COLUMN details jsonb NOT NULL DEFAULT '{}'::jsonb;