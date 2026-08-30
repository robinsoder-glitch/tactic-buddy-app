CREATE TABLE public.player_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  competition text NOT NULL DEFAULT 'Serie',
  matches integer NOT NULL DEFAULT 0,
  goals integer NOT NULL DEFAULT 0,
  assists integer NOT NULL DEFAULT 0,
  yellow_cards integer NOT NULL DEFAULT 0,
  red_cards integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_stats TO authenticated;
GRANT ALL ON public.player_stats TO service_role;

ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read player stats"
ON public.player_stats FOR SELECT TO authenticated
USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Coaches can insert player stats"
ON public.player_stats FOR INSERT TO authenticated
WITH CHECK (public.is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Coaches can update player stats"
ON public.player_stats FOR UPDATE TO authenticated
USING (public.is_team_coach(team_id, auth.uid()))
WITH CHECK (public.is_team_coach(team_id, auth.uid()));

CREATE POLICY "Coaches can delete player stats"
ON public.player_stats FOR DELETE TO authenticated
USING (public.is_team_coach(team_id, auth.uid()));

CREATE TRIGGER player_stats_set_updated_at
BEFORE UPDATE ON public.player_stats
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX player_stats_player_idx ON public.player_stats(player_id);