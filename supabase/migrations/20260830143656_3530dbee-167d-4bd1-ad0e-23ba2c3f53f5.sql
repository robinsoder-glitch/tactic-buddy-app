DROP POLICY IF EXISTS "team members read player photos" ON storage.objects;

CREATE POLICY "team members read player photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'player-photos'
  AND EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.photo_path = storage.objects.name
      AND p.team_id IS NOT NULL
      AND (public.is_team_member(p.team_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  )
);