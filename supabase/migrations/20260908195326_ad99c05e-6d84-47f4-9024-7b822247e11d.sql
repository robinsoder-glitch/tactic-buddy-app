-- Ta bort rättigheter som aldrig ska användas utan inloggning.
-- RLS blockerar redan anonyma anrop, men rättigheterna ska inte finnas kvar.
REVOKE ALL ON public.teams FROM anon;
REVOKE ALL ON public.clubs FROM anon;
GRANT SELECT ON public.clubs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
GRANT ALL ON public.teams TO service_role;