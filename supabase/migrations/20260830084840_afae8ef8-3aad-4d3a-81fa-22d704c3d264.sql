CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'coach' CHECK (role IN ('coach','player')),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX team_invites_team_email_idx ON public.team_invites (team_id, lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invites TO authenticated;
GRANT ALL ON public.team_invites TO service_role;

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches manage team invites"
ON public.team_invites FOR ALL TO authenticated
USING (public.is_team_coach(team_id, auth.uid()))
WITH CHECK (public.is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Invited users see their own invites"
ON public.team_invites FOR SELECT TO authenticated
USING (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

CREATE TRIGGER team_invites_set_updated_at
BEFORE UPDATE ON public.team_invites
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.redeem_team_invite(_team_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _uid uuid := auth.uid();
  _role text;
BEGIN
  IF _uid IS NULL OR _email = '' THEN
    RETURN NULL;
  END IF;

  SELECT role INTO _role
  FROM public.team_invites
  WHERE team_id = _team_id AND lower(email) = _email
  LIMIT 1;

  IF _role IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.team_members
  SET role = _role, status = 'approved'
  WHERE team_id = _team_id AND user_id = _uid;

  IF NOT FOUND THEN
    INSERT INTO public.team_members (team_id, user_id, role, status)
    VALUES (_team_id, _uid, _role, 'approved');
  END IF;

  IF _role = 'coach' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'coach'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  DELETE FROM public.team_invites WHERE team_id = _team_id AND lower(email) = _email;

  RETURN _role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_team_invite(uuid) TO authenticated;