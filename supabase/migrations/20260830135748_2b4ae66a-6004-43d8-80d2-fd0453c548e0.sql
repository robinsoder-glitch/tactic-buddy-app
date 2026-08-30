
DROP FUNCTION IF EXISTS public.redeem_team_invite(uuid);

CREATE OR REPLACE FUNCTION public.accept_team_invite(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.team_invites;
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Du måste vara inloggad.';
  END IF;

  SELECT * INTO inv FROM public.team_invites
  WHERE token = _token
    AND accepted_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'Inbjudan är ogiltig, förbrukad eller har gått ut.';
  END IF;

  IF lower(inv.email) <> mail THEN
    RAISE EXCEPTION 'Inbjudan gäller en annan e-postadress.';
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role, status)
  VALUES (inv.team_id, uid, inv.role, 'approved')
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = 'approved';

  IF inv.role = 'coach' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, 'coach') ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.team_invites
  SET accepted_at = now(), accepted_by = uid
  WHERE id = inv.id;

  RETURN inv.team_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_team_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_team_invite(text) TO authenticated;
