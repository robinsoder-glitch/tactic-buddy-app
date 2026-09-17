CREATE OR REPLACE FUNCTION public.copy_coach_session(_source uuid, _title text DEFAULT NULL::text, _team_id uuid DEFAULT NULL::uuid, _as_template boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  source_row public.coach_sessions%ROWTYPE;
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  SELECT * INTO source_row FROM public.coach_sessions WHERE id = _source;
  IF NOT FOUND THEN RAISE EXCEPTION 'Träningspasset kunde inte hittas.'; END IF;
  IF source_row.user_id <> auth.uid()
     AND NOT (source_row.team_id IS NOT NULL AND public.is_team_coach(source_row.team_id, auth.uid())) THEN
    RAISE EXCEPTION 'Du har inte behörighet till träningspasset.';
  END IF;
  IF _team_id IS NOT NULL AND NOT public.is_team_coach(_team_id, auth.uid()) THEN
    RAISE EXCEPTION 'Du har inte behörighet till laget.';
  END IF;

  INSERT INTO public.coach_sessions
    (user_id, title, session_date, age_group, game_format, theme, focus_areas, goal, notes, status,
     template_id, team_id, is_template, visibility, source_session_id)
  VALUES
    (auth.uid(), COALESCE(NULLIF(btrim(_title), ''), 'Kopia av ' || source_row.title), NULL,
     source_row.age_group, source_row.game_format, source_row.theme, source_row.focus_areas,
     source_row.goal, source_row.notes, 'draft', source_row.template_id, COALESCE(_team_id, source_row.team_id),
     _as_template, CASE WHEN _as_template THEN 'private' ELSE source_row.visibility END, source_row.id)
  RETURNING id INTO new_id;

  INSERT INTO public.coach_session_items
    (session_id, user_id, kind, title, resource_id, minutes, note, sort_order, details)
  SELECT new_id, auth.uid(), kind, title, resource_id, minutes, note, sort_order, details
  FROM public.coach_session_items
  WHERE session_id = _source
  ORDER BY sort_order, created_at, id;

  RETURN new_id;
END;
$function$;