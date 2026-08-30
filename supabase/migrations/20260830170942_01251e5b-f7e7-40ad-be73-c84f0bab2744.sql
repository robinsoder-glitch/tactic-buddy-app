ALTER TABLE public.coach_sessions ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS coach_sessions_team_id_idx ON public.coach_sessions(team_id);

CREATE POLICY "Team coaches can read team sessions"
ON public.coach_sessions
FOR SELECT
TO authenticated
USING (
  team_id IS NOT NULL
  AND (public.is_team_coach(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Team coaches can read team session items"
ON public.coach_session_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.coach_sessions s
    WHERE s.id = coach_session_items.session_id
      AND s.team_id IS NOT NULL
      AND (public.is_team_coach(s.team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  )
);