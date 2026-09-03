ALTER TABLE public.coach_sessions
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS source_session_id uuid REFERENCES public.coach_sessions(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coach_sessions_visibility_check'
  ) THEN
    ALTER TABLE public.coach_sessions
      ADD CONSTRAINT coach_sessions_visibility_check CHECK (visibility IN ('private','team'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS coach_sessions_template_idx ON public.coach_sessions(is_template, team_id);

CREATE OR REPLACE FUNCTION public.copy_coach_session(
  _source uuid,
  _title text DEFAULT NULL,
  _team_id uuid DEFAULT NULL,
  _as_template boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_src public.coach_sessions%ROWTYPE;
  v_new uuid;
  v_title text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT * INTO v_src FROM public.coach_sessions WHERE id = _source;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Passet kunde inte hittas.';
  END IF;

  IF v_src.user_id <> v_user
     AND NOT (
       v_src.team_id IS NOT NULL
       AND v_src.visibility = 'team'
       AND public.is_team_coach(v_src.team_id, v_user)
     ) THEN
    RAISE EXCEPTION 'Du har inte behörighet till passet.';
  END IF;

  IF _team_id IS NOT NULL AND NOT public.is_team_coach(_team_id, v_user) THEN
    RAISE EXCEPTION 'Du är inte ledare i laget.';
  END IF;

  v_title := COALESCE(NULLIF(btrim(_title), ''), v_src.title);

  INSERT INTO public.coach_sessions (
    user_id, title, session_date, age_group, game_format, theme, goal, notes,
    status, template_id, team_id, is_template, visibility, source_session_id
  ) VALUES (
    v_user, left(v_title, 200), NULL, v_src.age_group, v_src.game_format, v_src.theme,
    v_src.goal, v_src.notes, 'draft', v_src.template_id, _team_id,
    COALESCE(_as_template, false),
    CASE WHEN _team_id IS NULL THEN 'private' ELSE 'private' END,
    v_src.id
  )
  RETURNING id INTO v_new;

  INSERT INTO public.coach_session_items (session_id, user_id, kind, title, resource_id, minutes, note, sort_order)
  SELECT v_new, v_user, i.kind, i.title, i.resource_id, i.minutes, i.note,
         row_number() OVER (ORDER BY i.sort_order, i.created_at) - 1
  FROM public.coach_session_items i
  WHERE i.session_id = v_src.id;

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.copy_coach_session(uuid, text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_coach_session(uuid, text, uuid, boolean) TO authenticated;