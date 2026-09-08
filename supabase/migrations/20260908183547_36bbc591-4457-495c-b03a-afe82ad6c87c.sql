CREATE OR REPLACE FUNCTION public.set_team_codes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.join_code IS NULL OR NEW.join_code = '' THEN
    NEW.join_code := public.gen_team_code();
  END IF;
  IF NEW.coach_join_code IS NULL OR NEW.coach_join_code = '' THEN
    NEW.coach_join_code := public.gen_team_code();
  END IF;
  RETURN NEW;
END;
$$;