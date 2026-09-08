DO $$
DECLARE
  r record;
  sig text;
  keep_anon text[] := ARRAY['get_shared_match','get_shared_tactic','preview_team_invite'];
  internal_only text[] := ARRAY[
    'announcement_audience','gen_team_code','get_my_day_summary','get_player_private',
    'invitation_actor_role','is_adult_account','team_role'
  ];
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prorettype <> 'trigger'::regtype
  LOOP
    sig := format('public.%I(%s)', r.proname, pg_get_function_identity_arguments(r.oid));
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', sig);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', sig);

    IF r.proname = ANY(internal_only) THEN
      CONTINUE;
    END IF;

    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);

    IF r.proname = ANY(keep_anon) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', sig);
    END IF;
  END LOOP;
END $$;