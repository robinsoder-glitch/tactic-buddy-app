
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS archived_at timestamptz;

ALTER TABLE public.team_invites
  ADD COLUMN IF NOT EXISTS token text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

UPDATE public.team_invites
SET token = COALESCE(token, replace(gen_random_uuid()::text, '-', '')),
    expires_at = COALESCE(expires_at, now() + interval '14 days');

ALTER TABLE public.team_invites
  ALTER COLUMN token SET DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ALTER COLUMN token SET NOT NULL,
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '14 days'),
  ALTER COLUMN expires_at SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS team_invites_token_key ON public.team_invites (token);
DROP INDEX IF EXISTS team_invites_team_email_idx;
CREATE UNIQUE INDEX IF NOT EXISTS team_invites_open_email_idx
  ON public.team_invites (team_id, lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

DROP POLICY IF EXISTS "Invited users accept their own invites" ON public.team_invites;
CREATE POLICY "Invited users accept their own invites"
  ON public.team_invites FOR UPDATE TO authenticated
  USING (lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')) AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now())
  WITH CHECK (lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')) AND accepted_by = auth.uid());
