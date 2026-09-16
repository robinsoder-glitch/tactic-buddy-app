
-- Spelare och vårdnadshavare ska se exakt samma information om spelaren.
CREATE POLICY "Players and guardians read own stats"
ON public.player_stats FOR SELECT TO authenticated
USING (public.is_my_player(player_id) OR public.is_guardian_of(player_id));

DROP POLICY IF EXISTS "Attendance readable by team staff and guardians" ON public.event_attendance;
CREATE POLICY "Attendance readable by team staff and guardians"
ON public.event_attendance FOR SELECT TO authenticated
USING (
  public.can_manage_attendance(team_id, auth.uid())
  OR public.is_my_player(player_id)
  OR public.is_guardian_of(player_id)
);
