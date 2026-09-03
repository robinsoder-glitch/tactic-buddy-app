CREATE OR REPLACE FUNCTION public.gen_team_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  candidate text;
BEGIN
  LOOP
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.join_code = candidate OR t.coach_join_code = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.gen_team_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gen_team_code() TO service_role;