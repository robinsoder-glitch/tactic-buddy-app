ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_my_player(_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.id = _player_id AND p.member_user_id = auth.uid()
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_my_player(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_player(uuid) TO authenticated;

CREATE TABLE public.event_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','attending','declined','maybe')),
  comment text,
  respond_by date,
  message text,
  responded_by uuid REFERENCES auth.users(id),
  responded_at timestamptz,
  last_reminder_at timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, player_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invitations TO authenticated;
GRANT ALL ON public.event_invitations TO service_role;
ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches manage team invitations"
  ON public.event_invitations FOR ALL TO authenticated
  USING (public.is_team_coach(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_team_coach(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Players read own invitation"
  ON public.event_invitations FOR SELECT TO authenticated
  USING (public.is_my_player(player_id));

CREATE POLICY "Players answer own invitation"
  ON public.event_invitations FOR UPDATE TO authenticated
  USING (public.is_my_player(player_id))
  WITH CHECK (public.is_my_player(player_id));

CREATE TRIGGER event_invitations_updated_at
  BEFORE UPDATE ON public.event_invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.block_answer_on_cancelled_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status)
     OR (TG_OP = 'INSERT' AND NEW.status <> 'pending') THEN
    IF EXISTS (SELECT 1 FROM public.events e WHERE e.id = NEW.event_id AND e.cancelled_at IS NOT NULL) THEN
      RAISE EXCEPTION 'Aktiviteten är inställd. Det går inte att lämna nya svar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER event_invitations_block_cancelled
  BEFORE INSERT OR UPDATE ON public.event_invitations
  FOR EACH ROW EXECUTE FUNCTION public.block_answer_on_cancelled_event();

CREATE TABLE public.event_invitation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id uuid NOT NULL REFERENCES public.event_invitations(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_role text NOT NULL DEFAULT 'coach',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.event_invitation_log TO authenticated;
GRANT ALL ON public.event_invitation_log TO service_role;
ALTER TABLE public.event_invitation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches read invitation log"
  ON public.event_invitation_log FOR SELECT TO authenticated
  USING (public.is_team_coach(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members write invitation log"
  ON public.event_invitation_log FOR INSERT TO authenticated
  WITH CHECK (changed_by = auth.uid() AND public.is_team_member(team_id, auth.uid()));

CREATE TABLE public.app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'invite_reminder',
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.app_notifications TO authenticated;
GRANT ALL ON public.app_notifications TO service_role;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.app_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
  ON public.app_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Coaches create notifications for their team"
  ON public.app_notifications FOR INSERT TO authenticated
  WITH CHECK (team_id IS NOT NULL AND public.is_team_coach(team_id, auth.uid()));

CREATE INDEX idx_event_invitations_event ON public.event_invitations(event_id);
CREATE INDEX idx_event_invitations_player ON public.event_invitations(player_id);
CREATE INDEX idx_app_notifications_user ON public.app_notifications(user_id, created_at DESC);