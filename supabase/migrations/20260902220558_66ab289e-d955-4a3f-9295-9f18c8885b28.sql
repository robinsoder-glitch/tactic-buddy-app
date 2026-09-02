CREATE TABLE public.match_lineups (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  formation text NOT NULL,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  bench jsonb NOT NULL DEFAULT '[]'::jsonb,
  tactic_id uuid REFERENCES public.tactics(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_lineups TO authenticated;
GRANT ALL ON public.match_lineups TO service_role;
ALTER TABLE public.match_lineups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lagmedlemmar ser uppställningen" ON public.match_lineups FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Ledare hanterar uppställningen" ON public.match_lineups FOR INSERT TO authenticated
  WITH CHECK (public.is_team_coach(team_id, auth.uid()));
CREATE POLICY "Ledare ändrar uppställningen" ON public.match_lineups FOR UPDATE TO authenticated
  USING (public.is_team_coach(team_id, auth.uid())) WITH CHECK (public.is_team_coach(team_id, auth.uid()));
CREATE POLICY "Ledare tar bort uppställningen" ON public.match_lineups FOR DELETE TO authenticated
  USING (public.is_team_coach(team_id, auth.uid()));
CREATE TRIGGER match_lineups_updated_at BEFORE UPDATE ON public.match_lineups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.match_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_shares TO authenticated;
GRANT ALL ON public.match_shares TO service_role;
ALTER TABLE public.match_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ledare hanterar delningslänkar" ON public.match_shares FOR ALL TO authenticated
  USING (public.is_team_coach(team_id, auth.uid())) WITH CHECK (public.is_team_coach(team_id, auth.uid()));
CREATE TRIGGER match_shares_updated_at BEFORE UPDATE ON public.match_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP FUNCTION public.save_match_plan(uuid, uuid, text, uuid[], uuid[]);
CREATE OR REPLACE FUNCTION public.save_match_plan(
  _event_id uuid, _team_id uuid, _notes text, _player_ids uuid[], _coach_ids uuid[],
  _formation text, _slots jsonb, _bench uuid[], _tactic_id uuid, _required integer
) RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE
  uid uuid := auth.uid();
  starter_ids uuid[];
  all_ids uuid[];
  n int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Du måste vara inloggad.'; END IF;
  IF NOT public.is_team_coach(_team_id, uid) THEN RAISE EXCEPTION 'Endast lagets tränare kan spara planeringen.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = _event_id AND team_id = _team_id) THEN
    RAISE EXCEPTION 'Matchen hittades inte i laget.'; END IF;
  IF _player_ids IS NULL OR array_length(_player_ids, 1) IS NULL THEN RAISE EXCEPTION 'Välj minst en spelare.'; END IF;
  IF _coach_ids IS NULL OR array_length(_coach_ids, 1) IS NULL THEN RAISE EXCEPTION 'Välj minst en ledare.'; END IF;
  IF (SELECT count(*) FROM (SELECT unnest(_player_ids) AS p) q JOIN public.players pl ON pl.id = q.p WHERE pl.team_id = _team_id)
     <> array_length(_player_ids, 1) THEN RAISE EXCEPTION 'Alla spelare måste tillhöra laget.'; END IF;

  SELECT array_agg(DISTINCT (s->>'player_id')::uuid) INTO starter_ids
  FROM jsonb_array_elements(COALESCE(_slots, '[]'::jsonb)) s
  WHERE NULLIF(s->>'player_id', '') IS NOT NULL;
  starter_ids := COALESCE(starter_ids, '{}');

  SELECT count(*) INTO n FROM jsonb_array_elements(COALESCE(_slots, '[]'::jsonb)) s
  WHERE NULLIF(s->>'player_id', '') IS NOT NULL;
  IF n <> array_length(starter_ids, 1) THEN RAISE EXCEPTION 'Samma spelare kan bara stå på en planposition.'; END IF;

  IF _required IS NOT NULL AND _required > 0 AND n <> _required THEN
    RAISE EXCEPTION 'Det måste vara exakt % startspelare för vald spelform (nu %).', _required, n; END IF;

  all_ids := starter_ids || COALESCE(_bench, '{}');
  IF (SELECT count(*) FROM unnest(all_ids) a) <> (SELECT count(DISTINCT a) FROM unnest(all_ids) a) THEN
    RAISE EXCEPTION 'En avbytare kan inte samtidigt stå på planen.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(all_ids) a WHERE NOT (a = ANY(_player_ids))) THEN
    RAISE EXCEPTION 'Alla spelare på planen och bänken måste ingå i uttagningen.'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(_slots, '[]'::jsonb)) s
             WHERE (s->>'x')::float < 0 OR (s->>'x')::float > 1 OR (s->>'y')::float < 0 OR (s->>'y')::float > 1) THEN
    RAISE EXCEPTION 'Alla planpositioner måste ligga innanför planen.'; END IF;

  DELETE FROM public.event_squad WHERE event_id = _event_id;
  INSERT INTO public.event_squad (event_id, team_id, player_id, created_by)
  SELECT _event_id, _team_id, pid, uid FROM unnest(_player_ids) AS pid;

  DELETE FROM public.event_coaches WHERE event_id = _event_id;
  INSERT INTO public.event_coaches (event_id, team_id, user_id, created_by)
  SELECT DISTINCT _event_id, _team_id, cid, uid FROM unnest(_coach_ids) AS cid;

  INSERT INTO public.event_plans (event_id, team_id, created_by, notes, planning_done)
  VALUES (_event_id, _team_id, uid, NULLIF(btrim(COALESCE(_notes, '')), ''), true)
  ON CONFLICT (event_id) DO UPDATE SET notes = EXCLUDED.notes, planning_done = true;

  INSERT INTO public.match_lineups (event_id, team_id, formation, slots, bench, tactic_id, created_by)
  VALUES (_event_id, _team_id, _formation, COALESCE(_slots, '[]'::jsonb), to_jsonb(COALESCE(_bench, '{}')), _tactic_id, uid)
  ON CONFLICT (event_id) DO UPDATE SET formation = EXCLUDED.formation, slots = EXCLUDED.slots,
    bench = EXCLUDED.bench, tactic_id = EXCLUDED.tactic_id;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.get_shared_match(_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  s public.match_shares;
  result jsonb;
BEGIN
  SELECT * INTO s FROM public.match_shares WHERE token = _token LIMIT 1;
  IF s.id IS NULL OR s.revoked_at IS NOT NULL OR (s.expires_at IS NOT NULL AND s.expires_at <= now()) THEN
    RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'opponent', e.away_team,
    'home_team', e.home_team,
    'starts_at', e.starts_at,
    'meet_at', e.meet_at,
    'location', e.location,
    'match_kind', e.match_kind,
    'team_name', t.name,
    'formation', l.formation,
    'players', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', p.name, 'number', p.number, 'slot', slot->>'slot',
        'x', (slot->>'x')::float, 'y', (slot->>'y')::float, 'gk', COALESCE((slot->>'gk')::boolean, false)))
      FROM jsonb_array_elements(l.slots) slot
      LEFT JOIN public.players p ON p.id = NULLIF(slot->>'player_id', '')::uuid
    ), '[]'::jsonb),
    'bench', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', p.name, 'number', p.number))
      FROM jsonb_array_elements_text(l.bench) b JOIN public.players p ON p.id = b::uuid
    ), '[]'::jsonb)
  ) INTO result
  FROM public.events e
  JOIN public.teams t ON t.id = e.team_id
  JOIN public.match_lineups l ON l.event_id = e.id
  WHERE e.id = s.event_id;
  RETURN result;
END;
$fn$;
GRANT EXECUTE ON FUNCTION public.get_shared_match(text) TO anon, authenticated;
