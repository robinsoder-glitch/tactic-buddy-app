CREATE TABLE IF NOT EXISTS public.event_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id),
  changed_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_change_log_event_idx
  ON public.event_change_log (event_id, created_at DESC);

GRANT SELECT ON public.event_change_log TO authenticated;
GRANT ALL ON public.event_change_log TO service_role;

ALTER TABLE public.event_change_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Coaches read event change log" ON public.event_change_log;
CREATE POLICY "Coaches read event change log"
  ON public.event_change_log FOR SELECT TO authenticated
  USING (public.is_team_coach(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_event_change(
  _event_id uuid,
  _changed_fields jsonb,
  _notice text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  tid uuid;
  log_id uuid;
BEGIN
  SELECT team_id INTO tid FROM public.events WHERE id = _event_id;
  IF tid IS NULL THEN
    RAISE EXCEPTION 'Aktiviteten hittades inte.';
  END IF;
  IF NOT public.is_team_coach(tid, uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Endast lagets ledare kan ändra aktiviteten.';
  END IF;
  IF _changed_fields IS NULL OR jsonb_array_length(_changed_fields) = 0 THEN
    RETURN NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('event_change:' || _event_id::text, 0));

  SELECT id INTO log_id
  FROM public.event_change_log
  WHERE event_id = _event_id
    AND changed_fields = _changed_fields
    AND created_at > now() - interval '2 minutes'
  LIMIT 1;

  IF log_id IS NOT NULL THEN
    RETURN log_id;
  END IF;

  INSERT INTO public.event_change_log (event_id, team_id, changed_by, changed_fields)
  VALUES (_event_id, tid, uid, _changed_fields)
  RETURNING id INTO log_id;

  IF _notice IS NOT NULL AND length(btrim(_notice)) > 0 THEN
    INSERT INTO public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by)
    SELECT DISTINCT u.user_id, tid, _event_id, 'event_changed', 'Aktiviteten har ändrats', _notice, uid
    FROM public.event_invitations i
    JOIN LATERAL (
      SELECT p.member_user_id AS user_id FROM public.players p WHERE p.id = i.player_id
      UNION
      SELECT g.guardian_user_id FROM public.player_guardians g
        WHERE g.player_id = i.player_id AND g.is_active
    ) u ON u.user_id IS NOT NULL
    WHERE i.event_id = _event_id
      AND NOT EXISTS (
        SELECT 1 FROM public.app_notifications n
        WHERE n.user_id = u.user_id
          AND n.event_id = _event_id
          AND n.kind = 'event_changed'
          AND n.body = _notice
          AND n.created_at > now() - interval '2 minutes'
      );
  END IF;

  RETURN log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_event_change(uuid, jsonb, text) FROM public;
GRANT EXECUTE ON FUNCTION public.log_event_change(uuid, jsonb, text) TO authenticated;