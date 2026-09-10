CREATE OR REPLACE FUNCTION public.set_event_resource_order(p_event_id uuid, p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team uuid;
  v_missing int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad';
  END IF;

  SELECT team_id INTO v_team FROM public.events WHERE id = p_event_id;
  IF v_team IS NULL OR NOT public.is_team_coach(v_team) THEN
    RAISE EXCEPTION 'Ingen behörighet till aktiviteten';
  END IF;

  SELECT count(*) INTO v_missing
  FROM unnest(p_ids) AS t(id)
  LEFT JOIN public.event_resources r ON r.id = t.id AND r.event_id = p_event_id
  WHERE r.id IS NULL;

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Ordningen innehåller rader som inte hör till aktiviteten';
  END IF;

  UPDATE public.event_resources r
  SET sort_order = t.ord - 1
  FROM unnest(p_ids) WITH ORDINALITY AS t(id, ord)
  WHERE r.id = t.id AND r.event_id = p_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_event_resource_order(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_resource_order(uuid, uuid[]) TO authenticated, service_role;