ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

CREATE OR REPLACE FUNCTION public.get_team_leaders(_team_id uuid)
RETURNS TABLE(user_id uuid, display_name text, email text, phone text, is_owner boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tm.user_id,
    p.display_name,
    u.email::text,
    p.phone,
    (t.created_by = tm.user_id) AS is_owner
  FROM public.team_members tm
  JOIN public.profiles p ON p.id = tm.user_id
  JOIN auth.users u ON u.id = tm.user_id
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.team_id = _team_id
    AND tm.status = 'approved'
    AND tm.role IN ('owner', 'coach')
    AND public.is_team_member(_team_id, auth.uid())
  ORDER BY (t.created_by = tm.user_id) DESC, p.display_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_team_leaders(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_leaders(uuid) TO authenticated;