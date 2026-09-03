ALTER TABLE public.event_attendance
  ADD COLUMN IF NOT EXISTS absence_reason text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'event_attendance_absence_reason_check'
  ) THEN
    ALTER TABLE public.event_attendance
      ADD CONSTRAINT event_attendance_absence_reason_check
      CHECK (absence_reason IS NULL OR absence_reason IN ('sick', 'injured', 'other'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.save_event_attendance(
  _event_id uuid,
  _team_id uuid,
  _rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _duration integer;
  _row jsonb;
  _player_id uuid;
  _status text;
  _minutes integer;
  _reason text;
  _note text;
  _saved integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  IF NOT public.can_manage_attendance(_team_id, _uid) THEN
    RAISE EXCEPTION 'Du har inte behörighet att registrera närvaro för laget.';
  END IF;

  SELECT match_duration_minutes INTO _duration
  FROM public.events
  WHERE id = _event_id AND team_id = _team_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aktiviteten tillhör inte laget.';
  END IF;

  IF jsonb_typeof(_rows) <> 'array' THEN
    RAISE EXCEPTION 'Ogiltigt underlag för närvaro.';
  END IF;

  FOR _row IN SELECT * FROM jsonb_array_elements(_rows)
  LOOP
    _player_id := (_row->>'player_id')::uuid;
    _status := _row->>'status';
    _minutes := NULLIF(_row->>'minutes_played', '')::integer;
    _reason := NULLIF(_row->>'absence_reason', '');
    _note := NULLIF(btrim(coalesce(_row->>'note', '')), '');

    IF _player_id IS NULL THEN
      RAISE EXCEPTION 'En rad saknar spelare.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.players WHERE id = _player_id AND team_id = _team_id
    ) THEN
      RAISE EXCEPTION 'En spelare tillhör inte laget.';
    END IF;

    IF _status IS NULL OR _status NOT IN ('present', 'partial', 'absent') THEN
      RAISE EXCEPTION 'Ogiltig närvarostatus.';
    END IF;

    IF _reason IS NOT NULL AND _reason NOT IN ('sick', 'injured', 'other') THEN
      RAISE EXCEPTION 'Ogiltig frånvaroorsak.';
    END IF;

    IF _minutes IS NOT NULL THEN
      IF _minutes < 0 THEN
        RAISE EXCEPTION 'Speltiden kan inte vara negativ.';
      END IF;
      IF _duration IS NOT NULL AND _minutes > _duration THEN
        RAISE EXCEPTION 'Speltiden kan inte vara längre än matchens % minuter.', _duration;
      END IF;
    END IF;

    IF length(coalesce(_note, '')) > 300 THEN
      RAISE EXCEPTION 'Noteringen är för lång.';
    END IF;

    INSERT INTO public.event_attendance AS ea (
      event_id, team_id, player_id, status, note, minutes_played, absence_reason,
      created_by, registered_by, registered_at, updated_by, updated_at
    )
    VALUES (
      _event_id, _team_id, _player_id, _status, _note, _minutes, _reason,
      _uid, _uid, now(), _uid, now()
    )
    ON CONFLICT (event_id, player_id) DO UPDATE
      SET status = EXCLUDED.status,
          note = EXCLUDED.note,
          minutes_played = EXCLUDED.minutes_played,
          absence_reason = EXCLUDED.absence_reason,
          updated_by = _uid,
          updated_at = now();

    _saved := _saved + 1;
  END LOOP;

  RETURN _saved;
END;
$$;

REVOKE ALL ON FUNCTION public.save_event_attendance(uuid, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_event_attendance(uuid, uuid, jsonb) TO authenticated;