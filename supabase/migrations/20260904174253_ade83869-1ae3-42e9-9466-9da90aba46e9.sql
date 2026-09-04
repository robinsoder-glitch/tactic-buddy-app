-- Ta bort anonym direktläsning av taktiker och deras bilder
DROP POLICY IF EXISTS "Anyone can view shared tactics" ON public.tactics;
DROP POLICY IF EXISTS "Anyone can view frames of shared tactics" ON public.tactic_frames;

-- Säker läsning av en delad taktik, anonymiserad i databasen
CREATE OR REPLACE FUNCTION public.get_shared_tactic(_share_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t public.tactics;
  fr record;
  o jsonb;
  cleaned jsonb;
  objs jsonb;
  frames jsonb := '[]'::jsonb;
  labels jsonb := '{}'::jsonb;
  n integer := 0;
BEGIN
  SELECT * INTO t FROM public.tactics
  WHERE share_id = _share_id AND is_public = true;

  IF t.id IS NULL THEN
    RETURN NULL;
  END IF;

  FOR fr IN
    SELECT id, name, note, objects, drawings
    FROM public.tactic_frames
    WHERE tactic_id = t.id
    ORDER BY position
  LOOP
    objs := '[]'::jsonb;
    FOR o IN SELECT value FROM jsonb_array_elements(COALESCE(fr.objects, '[]'::jsonb))
    LOOP
      cleaned := (o - 'playerId') - 'photoUrl';
      IF o->>'kind' = 'player' THEN
        IF NOT (labels ? COALESCE(o->>'id', '')) THEN
          n := n + 1;
          labels := labels || jsonb_build_object(COALESCE(o->>'id', ''), 'Spelare ' || n);
        END IF;
        cleaned := cleaned || jsonb_build_object('label', labels->>COALESCE(o->>'id', ''));
      END IF;
      objs := objs || jsonb_build_array(cleaned);
    END LOOP;

    frames := frames || jsonb_build_array(jsonb_build_object(
      'id', fr.id,
      'name', fr.name,
      'note', fr.note,
      'objects', objs,
      'drawings', COALESCE(fr.drawings, '[]'::jsonb)
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'pitch_type', t.pitch_type,
    'frames', frames
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_shared_tactic(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_tactic(uuid) TO anon, authenticated, service_role;