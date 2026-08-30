ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_goalkeeper boolean NOT NULL DEFAULT false;

CREATE TABLE public.team_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  path text NOT NULL,
  caption text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_photos TO authenticated;
GRANT ALL ON public.team_photos TO service_role;

ALTER TABLE public.team_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team reads photos" ON public.team_photos
  FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "coaches manage photos" ON public.team_photos
  FOR ALL TO authenticated
  USING (public.is_team_coach(team_id, auth.uid()))
  WITH CHECK (public.is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());

CREATE TRIGGER team_photos_updated_at BEFORE UPDATE ON public.team_photos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- tighten personal player inserts: only teamless personal players
DROP POLICY IF EXISTS "own players" ON public.players;
CREATE POLICY "own players" ON public.players
  FOR ALL TO authenticated
  USING (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_coach(team_id, auth.uid())))
  WITH CHECK (auth.uid() = user_id AND (team_id IS NULL OR public.is_team_coach(team_id, auth.uid())));

-- storage policies for team-media (path prefix = team id)
CREATE POLICY "team media readable by members" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'team-media'
    AND public.is_team_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "team media insert by coaches" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'team-media'
    AND public.is_team_coach(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "team media update by coaches" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'team-media'
    AND public.is_team_coach(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "team media delete by coaches" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'team-media'
    AND public.is_team_coach(((storage.foldername(name))[1])::uuid, auth.uid())
  );