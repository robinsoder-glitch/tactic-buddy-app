CREATE OR REPLACE FUNCTION public.set_coach_session_item_order(p_session_id uuid, p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_missing int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad';
  END IF;

  SELECT user_id INTO v_owner FROM public.coach_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Ingen behörighet till träningspasset';
  END IF;

  SELECT count(*) INTO v_missing
  FROM unnest(p_ids) AS t(id)
  LEFT JOIN public.coach_session_items i ON i.id = t.id AND i.session_id = p_session_id
  WHERE i.id IS NULL;

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Ordningen innehåller rader som inte hör till passet';
  END IF;

  UPDATE public.coach_session_items i
  SET sort_order = t.ord - 1, updated_at = now()
  FROM unnest(p_ids) WITH ORDINALITY AS t(id, ord)
  WHERE i.id = t.id AND i.session_id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_coach_session_item_order(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_coach_session_item_order(uuid, uuid[]) TO authenticated, service_role;