ALTER TABLE public.event_resources DROP CONSTRAINT IF EXISTS event_resources_event_id_kind_resource_id_key;

CREATE TABLE public.coach_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  title text NOT NULL,
  minutes integer NOT NULL DEFAULT 10,
  instruction text,
  purpose text,
  equipment text,
  coach_focus text,
  in_library boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_drills TO authenticated;
GRANT ALL ON public.coach_drills TO service_role;

ALTER TABLE public.coach_drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own coach drills" ON public.coach_drills
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "team coaches read shared coach drills" ON public.coach_drills
  FOR SELECT TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_coach(team_id, auth.uid()));

CREATE TRIGGER coach_drills_updated_at BEFORE UPDATE ON public.coach_drills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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
  WHERE event_id = _event_id AND kind IN ('drill', 'session');

  INSERT INTO public.event_resources (event_id, team_id, created_by, kind, resource_id, minutes, note, sort_order)
  SELECT _event_id,
         _team_id,
         uid,
         COALESCE(item->>'kind', 'drill'),
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

CREATE OR REPLACE FUNCTION public.save_match_plan(
  _event_id uuid,
  _team_id uuid,
  _notes text,
  _player_ids uuid[],
  _coach_ids uuid[]
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
  IF _player_ids IS NULL OR array_length(_player_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Välj minst en spelare.';
  END IF;
  IF _coach_ids IS NULL OR array_length(_coach_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Välj minst en ledare.';
  END IF;

  DELETE FROM public.event_squad WHERE event_id = _event_id;
  INSERT INTO public.event_squad (event_id, team_id, player_id, created_by)
  SELECT _event_id, _team_id, pid, uid FROM unnest(_player_ids) AS pid;

  DELETE FROM public.event_coaches WHERE event_id = _event_id;
  INSERT INTO public.event_coaches (event_id, team_id, user_id, created_by)
  SELECT _event_id, _team_id, cid, uid FROM unnest(_coach_ids) AS cid;

  INSERT INTO public.event_plans (event_id, team_id, created_by, notes, planning_done)
  VALUES (_event_id, _team_id, uid, NULLIF(btrim(COALESCE(_notes, '')), ''), true)
  ON CONFLICT (event_id) DO UPDATE
    SET notes = EXCLUDED.notes,
        planning_done = true;
END;
$$;