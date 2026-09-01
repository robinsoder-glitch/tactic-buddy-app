CREATE TABLE public.event_coaches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  note text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_coaches TO authenticated;
GRANT ALL ON public.event_coaches TO service_role;

ALTER TABLE public.event_coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lagmedlemmar ser ansvariga tranare"
ON public.event_coaches FOR SELECT TO authenticated
USING (public.is_team_member(team_id, auth.uid()));

CREATE POLICY "Tranare hanterar ansvariga tranare"
ON public.event_coaches FOR ALL TO authenticated
USING (public.is_team_coach(team_id, auth.uid()))
WITH CHECK (public.is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());

CREATE TRIGGER event_coaches_set_updated_at
BEFORE UPDATE ON public.event_coaches
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();