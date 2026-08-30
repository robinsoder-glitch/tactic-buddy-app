CREATE TABLE public.event_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','sick','late')),
  note text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, player_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_attendance TO authenticated;
GRANT ALL ON public.event_attendance TO service_role;

ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view attendance"
ON public.event_attendance FOR SELECT TO authenticated
USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can insert attendance"
ON public.event_attendance FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (public.is_team_coach(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Coaches can update attendance"
ON public.event_attendance FOR UPDATE TO authenticated
USING (public.is_team_coach(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_team_coach(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches can delete attendance"
ON public.event_attendance FOR DELETE TO authenticated
USING (public.is_team_coach(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX event_attendance_team_idx ON public.event_attendance (team_id);
CREATE INDEX event_attendance_event_idx ON public.event_attendance (event_id);
CREATE INDEX event_attendance_player_idx ON public.event_attendance (player_id);

CREATE TRIGGER event_attendance_set_updated_at
BEFORE UPDATE ON public.event_attendance
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();