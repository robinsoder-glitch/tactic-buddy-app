CREATE TABLE public.team_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_chat_messages TO authenticated;
GRANT ALL ON public.team_chat_messages TO service_role;

ALTER TABLE public.team_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches read team chat"
ON public.team_chat_messages FOR SELECT TO authenticated
USING (public.is_team_coach(team_id, auth.uid()));

CREATE POLICY "Coaches write team chat"
ON public.team_chat_messages FOR INSERT TO authenticated
WITH CHECK (public.is_team_coach(team_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Authors update own messages"
ON public.team_chat_messages FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND public.is_team_coach(team_id, auth.uid()))
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Authors delete own messages"
ON public.team_chat_messages FOR DELETE TO authenticated
USING (user_id = auth.uid() AND public.is_team_coach(team_id, auth.uid()));

CREATE INDEX team_chat_messages_team_created_idx ON public.team_chat_messages (team_id, created_at DESC);

CREATE TRIGGER team_chat_messages_updated_at
BEFORE UPDATE ON public.team_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();