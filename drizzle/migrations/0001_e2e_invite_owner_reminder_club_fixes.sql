-- A. Klubbnamnet finns på klubben, inte på lagraden.
CREATE OR REPLACE FUNCTION public.preview_team_invite(_token text)
RETURNS TABLE(state text, team_name text, club_name text, age_group text, invite_role text, expires_at timestamptz, email_locked boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  inv public.team_invites;
  t public.teams;
  st text;
  club_label text;
BEGIN
  SELECT * INTO inv FROM public.team_invites WHERE token = _token LIMIT 1;
  IF inv.id IS NULL THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::timestamptz, false;
    RETURN;
  END IF;
  SELECT * INTO t FROM public.teams WHERE id = inv.team_id;
  SELECT c.name INTO club_label
  FROM public.teams team_row
  LEFT JOIN public.clubs c ON c.id = team_row.club_id
  WHERE team_row.id = inv.team_id;
  st := CASE
    WHEN inv.revoked_at IS NOT NULL THEN 'revoked'
    WHEN inv.accepted_at IS NOT NULL THEN 'used'
    WHEN inv.expires_at <= now() THEN 'expired'
    WHEN t.archived_at IS NOT NULL THEN 'archived'
    ELSE 'active'
  END;
  RETURN QUERY SELECT st, t.name, club_label, t.age_group, inv.role::text, inv.expires_at, (inv.email IS NOT NULL);
END;
$$;
GRANT EXECUTE ON FUNCTION public.preview_team_invite(text) TO anon, authenticated;

-- B. Ägarens medlemskap skyddas även när en annan ledare ändrar laget.
CREATE OR REPLACE FUNCTION public.guard_team_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid;
  uid uuid := auth.uid();
BEGIN
  -- Samma lås som vid överlåtelse hindrar samtidiga ändringar av ägarens medlemskap.
  SELECT created_by INTO owner_id FROM public.teams WHERE id = OLD.team_id FOR UPDATE;
  IF OLD.user_id IS DISTINCT FROM owner_id
     OR (uid IS NULL AND current_user IN ('postgres', 'supabase_admin', 'service_role'))
     OR public.is_platform_admin(uid) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Lagets ägare kan inte tas bort. Överlåt laget först.' USING ERRCODE = '42501';
  END IF;
  IF NEW.role IS NULL OR NEW.role NOT IN ('coach', 'head_coach', 'club_admin')
     OR NEW.status IS DISTINCT FROM 'approved'
     OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.team_id IS DISTINCT FROM OLD.team_id THEN
    RAISE EXCEPTION 'Lagets ägare måste vara en godkänd ledare. Överlåt laget först.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_team_owner_membership() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER team_members_guard_owner
BEFORE UPDATE OR DELETE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.guard_team_owner_membership();

-- C–E. Byt endast de felaktiga delarna och bevara funktionernas övriga logik och rättigheter.
DO $migration$
DECLARE
  original text;
  revised text;
BEGIN
  SELECT pg_get_functiondef('public.send_invite_reminders(uuid,text,text)'::regprocedure) INTO original;
  revised := replace(original, '  _names text;', E'  _names text;\n  targets jsonb;');
  revised := replace(revised, E'  CREATE TEMP TABLE _targets ON COMMIT DROP AS\n  SELECT', E'  -- Underlaget hör till anropet, inte till en tillfällig tabell i transaktionen.\n  SELECT COALESCE(jsonb_agg(to_jsonb(target)), ''[]''::jsonb) INTO targets\n  FROM (\n  SELECT');
  revised := replace(revised, E'  WHERE i.event_id = _event_id AND i.status = ''pending'';', E'  WHERE i.event_id = _event_id AND i.status = ''pending''\n  ) target;');
  revised := replace(revised, 'FROM _targets', E'FROM jsonb_to_recordset(targets) AS target(\n      invitation_id uuid, player_id uuid, player_name text, last_reminder_at timestamptz, user_id uuid)');
  IF revised = original OR position('CREATE TEMP TABLE _targets' IN revised) > 0 OR position('FROM _targets' IN revised) > 0 THEN
    RAISE EXCEPTION 'Påminnelsefunktionens definition stämmer inte med förväntat underlag.';
  END IF;
  EXECUTE revised;

  SELECT pg_get_functiondef('public.preview_announcement_audience(uuid,uuid,text,uuid[])'::regprocedure) INTO original;
  revised := replace(original, 'm.role=''coach''', 'm.role IN (''coach'',''head_coach'',''club_admin'')');
  IF revised = original THEN
    RAISE EXCEPTION 'Mottagarfunktionens definition stämmer inte med förväntat underlag.';
  END IF;
  EXECUTE revised;

  SELECT pg_get_functiondef('public.delete_own_team(uuid)'::regprocedure) INTO original;
  -- Laget raderas först så att kaskaden inte stoppas av medlemskapets ägarskydd.
  revised := replace(original,
    E'  DELETE FROM public.team_members WHERE team_id = _team_id;\n  DELETE FROM public.teams WHERE id = _team_id;',
    E'  -- Ägarskyddet ser ingen kvarvarande ägare när laget kaskadraderas.\n  DELETE FROM public.teams WHERE id = _team_id;\n  DELETE FROM public.team_members WHERE team_id = _team_id;\n\n  -- Delade klubbar och klubbar skapade av någon annan ska finnas kvar.\n  DELETE FROM public.clubs c\n  WHERE c.id = t.club_id AND c.created_by = uid\n    AND NOT EXISTS (SELECT 1 FROM public.teams t2 WHERE t2.club_id = c.id);');
  IF revised = original THEN
    RAISE EXCEPTION 'Raderingsfunktionens definition stämmer inte med förväntat underlag.';
  END IF;
  EXECUTE revised;
END;
$migration$;