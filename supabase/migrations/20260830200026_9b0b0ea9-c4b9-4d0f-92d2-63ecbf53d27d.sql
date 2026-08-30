CREATE TABLE public.event_plans (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_plans TO authenticated;
GRANT ALL ON public.event_plans TO service_role;
ALTER TABLE public.event_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads event plans" ON public.event_plans FOR SELECT TO authenticated
  USING (is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "coaches manage event plans" ON public.event_plans FOR ALL TO authenticated
  USING (is_team_coach(team_id, auth.uid()))
  WITH CHECK (is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());
CREATE TRIGGER event_plans_updated_at BEFORE UPDATE ON public.event_plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_squad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, player_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_squad TO authenticated;
GRANT ALL ON public.event_squad TO service_role;
ALTER TABLE public.event_squad ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team reads event squad" ON public.event_squad FOR SELECT TO authenticated
  USING (is_team_member(team_id, auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "coaches manage event squad" ON public.event_squad FOR ALL TO authenticated
  USING (is_team_coach(team_id, auth.uid()))
  WITH CHECK (is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());