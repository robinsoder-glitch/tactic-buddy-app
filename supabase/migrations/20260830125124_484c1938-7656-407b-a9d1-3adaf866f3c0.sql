CREATE TABLE IF NOT EXISTS public.coach_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  session_date date,
  age_group text,
  game_format text,
  theme text,
  goal text,
  notes text,
  status text NOT NULL DEFAULT 'draft',
  template_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coach_session_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.coach_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  resource_id text,
  minutes integer NOT NULL DEFAULT 10,
  note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coach_sessions_user_idx ON public.coach_sessions(user_id);
CREATE INDEX IF NOT EXISTS coach_session_items_session_idx ON public.coach_session_items(session_id, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_sessions TO authenticated;
GRANT ALL ON public.coach_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_session_items TO authenticated;
GRANT ALL ON public.coach_session_items TO service_role;

ALTER TABLE public.coach_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_session_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Egna träningspass" ON public.coach_sessions;
CREATE POLICY "Egna träningspass" ON public.coach_sessions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Egna passdelar" ON public.coach_session_items;
CREATE POLICY "Egna passdelar" ON public.coach_session_items
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.coach_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.coach_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()
  ));

DROP TRIGGER IF EXISTS coach_sessions_updated_at ON public.coach_sessions;
CREATE TRIGGER coach_sessions_updated_at BEFORE UPDATE ON public.coach_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS coach_session_items_updated_at ON public.coach_session_items;
CREATE TRIGGER coach_session_items_updated_at BEFORE UPDATE ON public.coach_session_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();