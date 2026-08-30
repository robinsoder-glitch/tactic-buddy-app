DROP POLICY IF EXISTS "Team members can view attendance" ON public.event_attendance;
CREATE POLICY "Coaches can view attendance"
ON public.event_attendance FOR SELECT TO authenticated
USING (public.is_team_coach(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Team members can read player stats" ON public.player_stats;
CREATE POLICY "Coaches can read player stats"
ON public.player_stats FOR SELECT TO authenticated
USING (public.is_team_coach(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));