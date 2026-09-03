CREATE OR REPLACE FUNCTION public.save_training_plan(
  _event_id uuid,
  _team_id uuid,
  _notes text,
  _items jsonb
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
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

  INSERT INTO public.event_resources (event_id, team_id, created_by, kind, resource_id, minutes, note, sort_order)
  SELECT _event_id,
         _team_id,
         uid,
         CASE WHEN COALESCE(item->>'kind', 'drill') IN ('drill', 'goalkeeper', 'session')
              THEN item->>'kind' ELSE 'drill' END,
         item->>'resource_id',
         NULLIF(item->>'minutes', '')::int,
         NULLIF(btrim(COALESCE(item->>'note', '')), ''),
         (ord - 1)::int
  FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) WITH ORDINALITY AS t(item, ord);

  INSERT INTO public.event_plans (event_id, team_id, created_by, notes, planning_done)
  VALUES (_event_id, _team_id, uid, NULLIF(btrim(COALESCE(_notes, '')), ''), jsonb_array_length(COALESCE(_items, '[]'::jsonb)) > 0)
  ON CONFLICT (event_id) DO UPDATE
    SET notes = EXCLUDED.notes,
        planning_done = EXCLUDED.planning_done;
END;
$$;