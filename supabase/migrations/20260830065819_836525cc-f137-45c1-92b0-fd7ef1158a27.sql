ALTER TABLE public.tactics
  ADD COLUMN IF NOT EXISTS share_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS tactics_share_id_key ON public.tactics(share_id);

ALTER TABLE public.tactic_frames ADD COLUMN IF NOT EXISTS note text;

GRANT SELECT ON public.tactics TO anon;
GRANT SELECT ON public.tactic_frames TO anon;

DROP POLICY IF EXISTS "Anyone can view shared tactics" ON public.tactics;
CREATE POLICY "Anyone can view shared tactics" ON public.tactics
  FOR SELECT TO anon, authenticated USING (is_public = true);

DROP POLICY IF EXISTS "Anyone can view frames of shared tactics" ON public.tactic_frames;
CREATE POLICY "Anyone can view frames of shared tactics" ON public.tactic_frames
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.tactics t WHERE t.id = tactic_frames.tactic_id AND t.is_public = true)
  );