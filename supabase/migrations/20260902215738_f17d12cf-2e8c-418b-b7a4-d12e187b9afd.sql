-- 1. Roller per lagmedlemskap
ALTER TABLE public.team_members
  DROP CONSTRAINT IF EXISTS team_members_role_check;
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check
  CHECK (role IN ('club_admin', 'head_coach', 'coach', 'guardian', 'player'));

-- Ledarroller ger tränarbehörighet i laget
CREATE OR REPLACE FUNCTION public.is_team_coach(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id
      AND user_id = _user_id
      AND role IN ('coach', 'head_coach', 'club_admin')
      AND status = 'approved'
  )
$$;

CREATE OR REPLACE FUNCTION public.team_role(_team_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.team_members
  WHERE team_id = _team_id AND user_id = _user_id AND status = 'approved'
  LIMIT 1
$$;

-- 2. Aktiva/inaktiva spelare
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 3. Vårdnadshavarkopplingar
CREATE TABLE IF NOT EXISTS public.player_guardians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  guardian_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relation text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, guardian_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_guardians TO authenticated;
GRANT ALL ON public.player_guardians TO service_role;

ALTER TABLE public.player_guardians ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_guardian_of(_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.player_guardians g
    WHERE g.player_id = _player_id
      AND g.guardian_user_id = auth.uid()
      AND g.is_active
  )
$$;

CREATE OR REPLACE FUNCTION public.player_team(_player_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT team_id FROM public.players WHERE id = _player_id
$$;

CREATE POLICY "Guardians read own links"
  ON public.player_guardians FOR SELECT TO authenticated
  USING (guardian_user_id = auth.uid());

CREATE POLICY "Coaches read team guardian links"
  ON public.player_guardians FOR SELECT TO authenticated
  USING (public.is_team_coach(public.player_team(player_id), auth.uid())
         OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coaches manage guardian links"
  ON public.player_guardians FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()
              AND public.is_team_coach(public.player_team(player_id), auth.uid()));

CREATE POLICY "Coaches update guardian links"
  ON public.player_guardians FOR UPDATE TO authenticated
  USING (public.is_team_coach(public.player_team(player_id), auth.uid()))
  WITH CHECK (public.is_team_coach(public.player_team(player_id), auth.uid()));

CREATE TRIGGER player_guardians_updated_at
  BEFORE UPDATE ON public.player_guardians
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Vårdnadshavares åtkomst till barnets kallelser och spelarkort
CREATE POLICY "Guardians read child invitation"
  ON public.event_invitations FOR SELECT TO authenticated
  USING (public.is_guardian_of(player_id));

CREATE POLICY "Guardians answer child invitation"
  ON public.event_invitations FOR UPDATE TO authenticated
  USING (public.is_guardian_of(player_id))
  WITH CHECK (public.is_guardian_of(player_id));

CREATE POLICY "Guardians read own child"
  ON public.players FOR SELECT TO authenticated
  USING (public.is_guardian_of(id));

-- Historik: vårdnadshavare måste kunna skriva sin ändring
DROP POLICY IF EXISTS "Members write invitation log" ON public.event_invitation_log;
CREATE POLICY "Members write invitation log"
  ON public.event_invitation_log FOR INSERT TO authenticated
  WITH CHECK (
    changed_by = auth.uid()
    AND (
      public.is_team_member(team_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.event_invitations i
        WHERE i.id = invitation_id AND public.is_guardian_of(i.player_id)
      )
    )
  );

CREATE POLICY "Guardians read child invitation log"
  ON public.event_invitation_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.event_invitations i
    WHERE i.id = invitation_id AND public.is_guardian_of(i.player_id)
  ));

-- 5. Påminnelser: bara obesvarade, aldrig dubbletter
CREATE OR REPLACE FUNCTION public.send_invite_reminders(_event_id uuid, _title text, _body text)
RETURNS TABLE(sent integer, skipped_recent integer, missing_account integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  _sent int := 0;
  _recent int := 0;
  _missing int := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT team_id INTO tid FROM public.events WHERE id = _event_id;
  IF tid IS NULL THEN
    RAISE EXCEPTION 'Aktiviteten hittades inte.';
  END IF;
  IF NOT public.is_team_coach(tid, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan skicka påminnelser.';
  END IF;

  CREATE TEMP TABLE _targets ON COMMIT DROP AS
  SELECT i.id AS invitation_id,
         i.player_id,
         i.last_reminder_at,
         u.user_id
  FROM public.event_invitations i
  LEFT JOIN LATERAL (
    SELECT p.member_user_id AS user_id FROM public.players p WHERE p.id = i.player_id
    UNION
    SELECT g.guardian_user_id FROM public.player_guardians g
      WHERE g.player_id = i.player_id AND g.is_active
  ) u ON true
  WHERE i.event_id = _event_id AND i.status = 'pending';

  SELECT count(DISTINCT invitation_id) INTO _recent
  FROM _targets WHERE last_reminder_at IS NOT NULL AND last_reminder_at > now() - interval '5 minutes';

  SELECT count(DISTINCT invitation_id) INTO _missing
  FROM _targets WHERE user_id IS NULL;

  WITH fresh AS (
    SELECT DISTINCT invitation_id, user_id
    FROM _targets
    WHERE user_id IS NOT NULL
      AND (last_reminder_at IS NULL OR last_reminder_at <= now() - interval '5 minutes')
  ), ins AS (
    INSERT INTO public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by)
    SELECT user_id, tid, _event_id, 'invite_reminder', _title, _body, uid FROM fresh
    RETURNING 1
  )
  SELECT count(*) INTO _sent FROM ins;

  UPDATE public.event_invitations
  SET last_reminder_at = now()
  WHERE id IN (
    SELECT DISTINCT invitation_id FROM _targets
    WHERE user_id IS NOT NULL
      AND (last_reminder_at IS NULL OR last_reminder_at <= now() - interval '5 minutes')
  );

  RETURN QUERY SELECT _sent, _recent, _missing;
END;
$$;

REVOKE ALL ON FUNCTION public.send_invite_reminders(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.send_invite_reminders(uuid, text, text) TO authenticated;