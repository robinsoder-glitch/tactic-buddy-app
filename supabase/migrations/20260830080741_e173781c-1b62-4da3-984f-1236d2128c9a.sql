CREATE TABLE public.tb_rulesets (
  id text PRIMARY KEY,
  format text NOT NULL,
  season text,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tb_rulesets TO authenticated;
GRANT ALL ON public.tb_rulesets TO service_role;
ALTER TABLE public.tb_rulesets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches read rulesets" ON public.tb_rulesets FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER tb_rulesets_updated_at BEFORE UPDATE ON public.tb_rulesets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tb_district_profiles (
  id text PRIMARY KEY,
  name text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tb_district_profiles TO authenticated;
GRANT ALL ON public.tb_district_profiles TO service_role;
ALTER TABLE public.tb_district_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches read districts" ON public.tb_district_profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER tb_district_profiles_updated_at BEFORE UPDATE ON public.tb_district_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tb_formations (
  id text PRIMARY KEY,
  format text NOT NULL,
  name text NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tb_formations TO authenticated;
GRANT ALL ON public.tb_formations TO service_role;
ALTER TABLE public.tb_formations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches read formations" ON public.tb_formations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER tb_formations_updated_at BEFORE UPDATE ON public.tb_formations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tb_taxonomy (
  id text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tb_taxonomy TO authenticated;
GRANT ALL ON public.tb_taxonomy TO service_role;
ALTER TABLE public.tb_taxonomy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches read taxonomy" ON public.tb_taxonomy FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER tb_taxonomy_updated_at BEFORE UPDATE ON public.tb_taxonomy FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tb_tactics (
  id text PRIMARY KEY,
  title text NOT NULL,
  format text NOT NULL,
  difficulty integer NOT NULL DEFAULT 1,
  game_moment text,
  phase text,
  purpose text,
  formation_ref text,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tb_tactics TO authenticated;
GRANT ALL ON public.tb_tactics TO service_role;
ALTER TABLE public.tb_tactics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches read tactic cards" ON public.tb_tactics FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER tb_tactics_updated_at BEFORE UPDATE ON public.tb_tactics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tb_goalkeeper_cards (
  id text PRIMARY KEY,
  title text NOT NULL,
  purpose text,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tb_goalkeeper_cards TO authenticated;
GRANT ALL ON public.tb_goalkeeper_cards TO service_role;
ALTER TABLE public.tb_goalkeeper_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches read gk cards" ON public.tb_goalkeeper_cards FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER tb_goalkeeper_cards_updated_at BEFORE UPDATE ON public.tb_goalkeeper_cards FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tb_drills (
  id text PRIMARY KEY,
  title text NOT NULL,
  default_minutes integer,
  purpose text,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tb_drills TO authenticated;
GRANT ALL ON public.tb_drills TO service_role;
ALTER TABLE public.tb_drills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches read drills" ON public.tb_drills FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER tb_drills_updated_at BEFORE UPDATE ON public.tb_drills FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tb_training_sessions (
  id text PRIMARY KEY,
  title text NOT NULL,
  total_minutes integer,
  theme text,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tb_training_sessions TO authenticated;
GRANT ALL ON public.tb_training_sessions TO service_role;
ALTER TABLE public.tb_training_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches read sessions" ON public.tb_training_sessions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coach'::app_role) OR has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER tb_training_sessions_updated_at BEFORE UPDATE ON public.tb_training_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'tactic',
  resource_id text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, kind, resource_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_resources TO authenticated;
GRANT ALL ON public.event_resources TO service_role;
ALTER TABLE public.event_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads event resources" ON public.event_resources FOR SELECT TO authenticated
  USING (is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "coaches manage event resources" ON public.event_resources FOR ALL TO authenticated
  USING (is_team_coach(team_id, auth.uid()))
  WITH CHECK (is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());
CREATE TRIGGER event_resources_updated_at BEFORE UPDATE ON public.event_resources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();