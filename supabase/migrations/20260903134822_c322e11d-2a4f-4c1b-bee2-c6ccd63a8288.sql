CREATE OR REPLACE FUNCTION public.can_see_member_profile(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members target
    JOIN public.team_members viewer ON viewer.team_id = target.team_id
    WHERE target.user_id = _profile_id
      AND viewer.user_id = auth.uid()
      AND viewer.status = 'approved'
      AND viewer.role IN ('coach', 'head_coach', 'club_admin')
  )
$$;

REVOKE ALL ON FUNCTION public.can_see_member_profile(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_see_member_profile(uuid) TO authenticated;

CREATE POLICY "coaches read member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.can_see_member_profile(id));