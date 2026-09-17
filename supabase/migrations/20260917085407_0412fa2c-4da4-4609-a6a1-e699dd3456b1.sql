ALTER TABLE public.event_plans
  ADD COLUMN focus_areas text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN goal text;

CREATE OR REPLACE FUNCTION public.save_training_plan_v2(
  _event_id uuid,
  _team_id uuid,
  _notes text,
  _focus_areas text[],
  _goal text,
  _items jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  IF NOT public.is_team_coach(_team_id, uid) THEN
    RAISE EXCEPTION 'Endast lagets tränare kan spara planeringen.';
  END IF;

  DELETE FROM public.event_resources
  WHERE event_id = _event_id AND kind IN ('drill', 'goalkeeper', 'session');

  INSERT INTO public.event_resources
    (event_id, team_id, created_by, kind, resource_id, minutes, note, sort_order, details)
  SELECT _event_id, _team_id, uid,
         CASE WHEN COALESCE(item->>'kind', 'drill') IN ('drill', 'goalkeeper', 'session')
              THEN item->>'kind' ELSE 'drill' END,
         item->>'resource_id', NULLIF(item->>'minutes', '')::int,
         NULLIF(btrim(COALESCE(item->>'note', '')), ''), (ord - 1)::int,
         COALESCE(item->'details', '{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(_items, '[]'::jsonb)) WITH ORDINALITY AS t(item, ord);

  INSERT INTO public.event_plans
    (event_id, team_id, created_by, notes, focus_areas, goal, planning_done)
  VALUES
    (_event_id, _team_id, uid, NULLIF(btrim(COALESCE(_notes, '')), ''),
     COALESCE(_focus_areas, '{}'::text[]), NULLIF(btrim(COALESCE(_goal, '')), ''),
     jsonb_array_length(COALESCE(_items, '[]'::jsonb)) > 0
     AND cardinality(COALESCE(_focus_areas, '{}'::text[])) > 0
     AND NULLIF(btrim(COALESCE(_goal, '')), '') IS NOT NULL)
  ON CONFLICT (event_id) DO UPDATE
    SET notes = EXCLUDED.notes,
        focus_areas = EXCLUDED.focus_areas,
        goal = EXCLUDED.goal,
        planning_done = EXCLUDED.planning_done;
END;
$function$;

REVOKE ALL ON FUNCTION public.save_training_plan_v2(uuid, uuid, text, text[], text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_training_plan_v2(uuid, uuid, text, text[], text, jsonb) TO authenticated, service_role;