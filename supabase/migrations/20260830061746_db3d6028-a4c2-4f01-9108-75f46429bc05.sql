CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number INTEGER,
  team TEXT NOT NULL DEFAULT 'home',
  photo_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own players" ON public.players FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX players_user_idx ON public.players(user_id);
CREATE TRIGGER players_updated_at BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tactics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Ny taktik',
  pitch_type TEXT NOT NULL DEFAULT 'full',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tactics TO authenticated;
GRANT ALL ON public.tactics TO service_role;
ALTER TABLE public.tactics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tactics" ON public.tactics FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tactics_user_idx ON public.tactics(user_id);
CREATE TRIGGER tactics_updated_at BEFORE UPDATE ON public.tactics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.tactic_frames (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tactic_id UUID NOT NULL REFERENCES public.tactics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  objects JSONB NOT NULL DEFAULT '[]'::jsonb,
  drawings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tactic_frames TO authenticated;
GRANT ALL ON public.tactic_frames TO service_role;
ALTER TABLE public.tactic_frames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own frames" ON public.tactic_frames FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX tactic_frames_tactic_idx ON public.tactic_frames(tactic_id, position);
CREATE TRIGGER tactic_frames_updated_at BEFORE UPDATE ON public.tactic_frames FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "player photos read own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'player-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "player photos insert own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'player-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "player photos update own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'player-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "player photos delete own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'player-photos' AND auth.uid()::text = (storage.foldername(name))[1]);