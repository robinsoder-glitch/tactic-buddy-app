-- 1. Aktivitetens längd
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS match_duration_minutes int;

-- 2. Närvaro: nya kolumner
ALTER TABLE public.event_attendance
  ADD COLUMN IF NOT EXISTS minutes_played int,
  ADD COLUMN IF NOT EXISTS registered_by uuid,
  ADD COLUMN IF NOT EXISTS registered_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by uuid;

UPDATE public.event_attendance SET registered_by = created_by WHERE registered_by IS NULL;

-- Statusmigrering
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.event_attendance'::regclass AND contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.event_attendance DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

UPDATE public.event_attendance SET status = 'partial' WHERE status = 'late';
UPDATE public.event_attendance SET status = 'absent' WHERE status = 'sick';

ALTER TABLE public.event_attendance
  ADD CONSTRAINT event_attendance_status_check
  CHECK (status IN ('present', 'absent', 'partial', 'unregistered'));

ALTER TABLE public.event_attendance
  ADD CONSTRAINT event_attendance_minutes_nonnegative
  CHECK (minutes_played IS NULL OR minutes_played >= 0);

-- Dedupe före unik nyckel
DELETE FROM public.event_attendance a
USING public.event_attendance b
WHERE a.event_id = b.event_id
  AND a.player_id = b.player_id
  AND a.ctid < b.ctid;

ALTER TABLE public.event_attendance
  ADD CONSTRAINT event_attendance_event_player_key UNIQUE (event_id, player_id);

-- Validering mot aktivitetens längd
CREATE OR REPLACE FUNCTION public.validate_attendance_minutes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE total int;
BEGIN
  IF NEW.minutes_played IS NOT NULL THEN
    SELECT e.match_duration_minutes INTO total FROM public.events e WHERE e.id = NEW.event_id;
    IF total IS NOT NULL AND NEW.minutes_played > total THEN
      RAISE EXCEPTION 'Spelad tid (% min) kan inte överstiga aktivitetens längd (% min).', NEW.minutes_played, total;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_attendance_validate_minutes ON public.event_attendance;
CREATE TRIGGER event_attendance_validate_minutes
BEFORE INSERT OR UPDATE ON public.event_attendance
FOR EACH ROW EXECUTE FUNCTION public.validate_attendance_minutes();

-- 3. Lagledarbehörighet för närvaro
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS can_manage_attendance boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_manage_attendance(_team_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_team_coach(_team_id, _user_id)
      OR public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.team_members m
        WHERE m.team_id = _team_id AND m.user_id = _user_id
          AND m.status = 'approved' AND m.can_manage_attendance
      )
$$;

-- 4. RLS för närvaro
DROP POLICY IF EXISTS "Coaches can view attendance" ON public.event_attendance;
DROP POLICY IF EXISTS "Coaches can insert attendance" ON public.event_attendance;
DROP POLICY IF EXISTS "Coaches can update attendance" ON public.event_attendance;
DROP POLICY IF EXISTS "Coaches can delete attendance" ON public.event_attendance;

CREATE POLICY "Attendance readable by team staff and guardians"
ON public.event_attendance FOR SELECT TO authenticated
USING (
  public.can_manage_attendance(team_id, auth.uid())
  OR public.is_my_player(player_id)
);

CREATE POLICY "Attendance managers can insert"
ON public.event_attendance FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.can_manage_attendance(team_id, auth.uid()));

CREATE POLICY "Attendance managers can update"
ON public.event_attendance FOR UPDATE TO authenticated
USING (public.can_manage_attendance(team_id, auth.uid()))
WITH CHECK (public.can_manage_attendance(team_id, auth.uid()));

CREATE POLICY "Attendance managers can delete"
ON public.event_attendance FOR DELETE TO authenticated
USING (public.can_manage_attendance(team_id, auth.uid()));

-- 5. Index och unik statistik
CREATE INDEX IF NOT EXISTS players_team_name_idx ON public.players (team_id, lower(name));

DELETE FROM public.player_stats a
USING public.player_stats b
WHERE a.player_id = b.player_id AND a.competition = b.competition AND a.ctid < b.ctid;

ALTER TABLE public.player_stats
  ADD CONSTRAINT player_stats_player_competition_key UNIQUE (player_id, competition);

-- 6. kb_articles read-only inför avveckling
DROP POLICY IF EXISTS "Admin kan skapa artiklar" ON public.kb_articles;
DROP POLICY IF EXISTS "Admin kan andra artiklar" ON public.kb_articles;
DROP POLICY IF EXISTS "Admin kan radera artiklar" ON public.kb_articles;
REVOKE INSERT, UPDATE, DELETE ON public.kb_articles FROM authenticated;