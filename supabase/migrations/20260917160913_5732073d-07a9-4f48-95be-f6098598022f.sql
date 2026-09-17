CREATE TABLE public.invite_flow_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event text NOT NULL,
  team_code text,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  user_id uuid,
  role text,
  path text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.invite_flow_events TO anon;
GRANT INSERT, SELECT ON public.invite_flow_events TO authenticated;
GRANT ALL ON public.invite_flow_events TO service_role;

ALTER TABLE public.invite_flow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a flow event"
  ON public.invite_flow_events FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Platform admins can read flow events"
  ON public.invite_flow_events FOR SELECT TO authenticated
  USING (public.is_platform_admin(auth.uid()));

CREATE INDEX invite_flow_events_created_idx ON public.invite_flow_events (created_at DESC);
CREATE INDEX invite_flow_events_event_idx ON public.invite_flow_events (event, created_at DESC);