
INSERT INTO public.team_members (team_id, user_id, role, status)
SELECT t.id, t.created_by, 'coach', 'approved'
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1 FROM public.team_members m WHERE m.team_id = t.id AND m.user_id = t.created_by
)
ON CONFLICT (team_id, user_id) DO UPDATE SET role = 'coach', status = 'approved';
