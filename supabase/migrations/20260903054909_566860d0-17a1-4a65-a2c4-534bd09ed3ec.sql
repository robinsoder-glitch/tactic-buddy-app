-- 1. helper
CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

-- 2. admin full access policies on all app tables
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'clubs','teams','team_members','team_invites','team_photos','team_chat_messages',
  'players','player_guardians','player_stats','player_focus_areas','player_observations',
  'events','event_attendance','event_coaches','event_invitations','event_invitation_log',
  'event_plans','event_resources','event_squad',
  'match_lineups','match_shares',
  'coach_sessions','coach_session_items','coach_drills',
  'session_runs','session_run_items','session_run_attendance','session_run_player_notes',
  'team_periods','period_links','period_progression',
  'tactics','tactic_frames','content_links','app_notifications','profiles','knowledge_articles'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Platform admin full access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Platform admin full access" ON public.%I FOR ALL TO authenticated USING (public.is_platform_admin(auth.uid())) WITH CHECK (public.is_platform_admin(auth.uid()))',
      t);
  END LOOP;
END $$;

-- 3. admin manages roles
DROP POLICY IF EXISTS "Platform admin reads roles" ON public.user_roles;
CREATE POLICY "Platform admin reads roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admin grants roles" ON public.user_roles;
CREATE POLICY "Platform admin grants roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_admin(auth.uid()));
DROP POLICY IF EXISTS "Platform admin revokes roles" ON public.user_roles;
CREATE POLICY "Platform admin revokes roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.is_platform_admin(auth.uid()));

-- 4. allowlist of emails that become platform admin on verified signup
CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email text PRIMARY KEY,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_allowlist TO authenticated;
GRANT ALL ON public.admin_allowlist TO service_role;
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admin manages allowlist" ON public.admin_allowlist;
CREATE POLICY "Platform admin manages allowlist" ON public.admin_allowlist
  FOR ALL TO authenticated
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

INSERT INTO public.admin_allowlist (email, note)
VALUES ('robin@eckersundsoderadvokater.se', 'Plattformsägare')
ON CONFLICT (email) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_admin_for_allowlisted_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.admin_allowlist a WHERE a.email = lower(NEW.email)) THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_grant_admin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_admin_for_allowlisted_email();

DROP TRIGGER IF EXISTS on_auth_user_confirmed_grant_admin ON auth.users;
CREATE TRIGGER on_auth_user_confirmed_grant_admin
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_admin_for_allowlisted_email();

-- retroactive grant for already-confirmed allowlisted accounts
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
JOIN public.admin_allowlist a ON a.email = lower(u.email)
WHERE u.email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 5. audit log
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Platform admin reads audit log" ON public.admin_audit_log;
CREATE POLICY "Platform admin reads audit log" ON public.admin_audit_log
  FOR SELECT TO authenticated USING (public.is_platform_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON public.admin_audit_log (created_at DESC);