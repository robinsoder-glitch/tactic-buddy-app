CREATE TABLE public.player_homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  due_date date,
  done_at timestamptz,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX player_homework_player_idx ON public.player_homework(player_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_homework TO authenticated;
GRANT ALL ON public.player_homework TO service_role;
ALTER TABLE public.player_homework ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coaches manage homework" ON public.player_homework FOR ALL TO authenticated
  USING (public.is_team_coach(team_id, auth.uid()))
  WITH CHECK (public.is_team_coach(team_id, auth.uid()) AND public.player_team(player_id) = team_id);
CREATE POLICY "player and guardian read homework" ON public.player_homework FOR SELECT TO authenticated
  USING (public.is_my_player(player_id) OR public.is_guardian_of(player_id));
CREATE TRIGGER player_homework_updated_at BEFORE UPDATE ON public.player_homework
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();