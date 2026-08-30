REVOKE EXECUTE ON FUNCTION public.redeem_team_invite(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_team_invite(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.redeem_team_invite(uuid) TO authenticated;