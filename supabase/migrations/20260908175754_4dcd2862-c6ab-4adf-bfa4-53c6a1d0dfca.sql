REVOKE INSERT ON public.teams FROM authenticated;
GRANT INSERT (id, club_id, name, age_group, gender, photo_path, about, created_by,
  created_at, updated_at, home_ground, archived_at, game_format) ON public.teams TO authenticated;