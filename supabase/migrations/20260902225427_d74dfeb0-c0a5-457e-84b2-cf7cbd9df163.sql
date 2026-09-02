-- 10E: genomförande av träning
CREATE TABLE public.session_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.coach_sessions(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  coach_id uuid NOT NULL DEFAULT auth.uid(),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','done','abandoned')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  paused_at timestamptz,
  paused_seconds integer NOT NULL DEFAULT 0 CHECK (paused_seconds >= 0),
  adjust_seconds integer NOT NULL DEFAULT 0,
  current_index integer NOT NULL DEFAULT 0 CHECK (current_index >= 0),
  general_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX session_runs_one_active ON public.session_runs (session_id) WHERE status = 'active';
CREATE INDEX session_runs_coach_idx ON public.session_runs (coach_id, status);

CREATE TABLE public.session_run_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.session_runs(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.coach_session_items(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'custom',
  title text NOT NULL,
  resource_id text,
  planned_minutes integer NOT NULL DEFAULT 10 CHECK (planned_minutes >= 0),
  actual_seconds integer NOT NULL DEFAULT 0 CHECK (actual_seconds >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','skipped')),
  note text,
  sort_order integer NOT NULL DEFAULT 0
);
CREATE INDEX session_run_items_run_idx ON public.session_run_items (run_id, sort_order);

CREATE TABLE public.session_run_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.session_runs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present','partial','absent')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, player_id)
);

CREATE TABLE public.session_run_player_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.session_runs(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, player_id)
);

-- 10F: periodplan och spelarutveckling
CREATE TABLE public.team_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  main_theme text NOT NULL,
  sub_themes text[] NOT NULL DEFAULT '{}' CHECK (cardinality(sub_themes) <= 2),
  goal text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);
CREATE INDEX team_periods_team_idx ON public.team_periods (team_id, start_date);

CREATE TABLE public.period_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.team_periods(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('event','drill','tactic','article','session')),
  resource_id text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, kind, resource_id)
);

CREATE TABLE public.period_progression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.team_periods(id) ON DELETE CASCADE,
  step integer NOT NULL CHECK (step BETWEEN 1 AND 4),
  notes text,
  UNIQUE (period_id, step)
);

CREATE TABLE public.player_focus_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  period_id uuid REFERENCES public.team_periods(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','achieved','paused')),
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX player_focus_areas_player_idx ON public.player_focus_areas (player_id, status);

CREATE TABLE public.player_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  focus_area_id uuid REFERENCES public.player_focus_areas(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX player_observations_player_idx ON public.player_observations (player_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.limit_active_focus_areas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'active' AND (
    SELECT count(*) FROM public.player_focus_areas
    WHERE player_id = NEW.player_id AND status = 'active' AND id <> NEW.id
  ) >= 3 THEN
    RAISE EXCEPTION 'En spelare kan ha högst tre aktiva fokusområden.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER limit_active_focus_areas_trg BEFORE INSERT OR UPDATE ON public.player_focus_areas
FOR EACH ROW EXECUTE FUNCTION public.limit_active_focus_areas();

CREATE TRIGGER session_runs_updated_at BEFORE UPDATE ON public.session_runs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER team_periods_updated_at BEFORE UPDATE ON public.team_periods
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER player_focus_areas_updated_at BEFORE UPDATE ON public.player_focus_areas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_run_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_run_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_run_player_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_periods TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.period_links TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.period_progression TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_focus_areas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_observations TO authenticated;
GRANT ALL ON public.session_runs, public.session_run_items, public.session_run_attendance,
  public.session_run_player_notes, public.team_periods, public.period_links,
  public.period_progression, public.player_focus_areas, public.player_observations TO service_role;

ALTER TABLE public.session_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_run_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_run_player_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.period_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_focus_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tranaren hanterar sina genomforanden" ON public.session_runs FOR ALL TO authenticated
USING (coach_id = auth.uid() OR (team_id IS NOT NULL AND public.is_team_coach(team_id, auth.uid())))
WITH CHECK (coach_id = auth.uid() OR (team_id IS NOT NULL AND public.is_team_coach(team_id, auth.uid())));

CREATE POLICY "Moment foljer genomforandet" ON public.session_run_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.session_runs r WHERE r.id = run_id
  AND (r.coach_id = auth.uid() OR (r.team_id IS NOT NULL AND public.is_team_coach(r.team_id, auth.uid())))))
WITH CHECK (EXISTS (SELECT 1 FROM public.session_runs r WHERE r.id = run_id
  AND (r.coach_id = auth.uid() OR (r.team_id IS NOT NULL AND public.is_team_coach(r.team_id, auth.uid())))));

CREATE POLICY "Narvaro foljer genomforandet" ON public.session_run_attendance FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.session_runs r WHERE r.id = run_id
  AND (r.coach_id = auth.uid() OR (r.team_id IS NOT NULL AND public.is_team_coach(r.team_id, auth.uid())))))
WITH CHECK (EXISTS (SELECT 1 FROM public.session_runs r WHERE r.id = run_id
  AND (r.coach_id = auth.uid() OR (r.team_id IS NOT NULL AND public.is_team_coach(r.team_id, auth.uid())))));

CREATE POLICY "Privata anteckningar foljer genomforandet" ON public.session_run_player_notes FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.session_runs r WHERE r.id = run_id
  AND (r.coach_id = auth.uid() OR (r.team_id IS NOT NULL AND public.is_team_coach(r.team_id, auth.uid())))))
WITH CHECK (EXISTS (SELECT 1 FROM public.session_runs r WHERE r.id = run_id
  AND (r.coach_id = auth.uid() OR (r.team_id IS NOT NULL AND public.is_team_coach(r.team_id, auth.uid())))));

CREATE POLICY "Ledare hanterar lagets perioder" ON public.team_periods FOR ALL TO authenticated
USING (public.is_team_coach(team_id, auth.uid())) WITH CHECK (public.is_team_coach(team_id, auth.uid()));

CREATE POLICY "Kopplingar foljer perioden" ON public.period_links FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.team_periods p WHERE p.id = period_id AND public.is_team_coach(p.team_id, auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.team_periods p WHERE p.id = period_id AND public.is_team_coach(p.team_id, auth.uid())));

CREATE POLICY "Progression foljer perioden" ON public.period_progression FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.team_periods p WHERE p.id = period_id AND public.is_team_coach(p.team_id, auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.team_periods p WHERE p.id = period_id AND public.is_team_coach(p.team_id, auth.uid())));

CREATE POLICY "Ledare hanterar fokusomraden" ON public.player_focus_areas FOR ALL TO authenticated
USING (public.is_team_coach(team_id, auth.uid())) WITH CHECK (public.is_team_coach(team_id, auth.uid()));

CREATE POLICY "Ledare hanterar observationer" ON public.player_observations FOR ALL TO authenticated
USING (public.is_team_coach(team_id, auth.uid())) WITH CHECK (public.is_team_coach(team_id, auth.uid()));