create or replace function public.join_team_with_profile(_code text, _account_kind text, _child_name text)
returns table(team_id uuid, team_name text, member_role text, member_status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  -- Profilskrivning och anslutning i samma transaktion: fel i något steg
  -- rullar tillbaka allt, så profilen aldrig lämnas halvändrad.
  -- account_kind sätts bara om den inte redan är vald – en tränare eller
  -- spelare som går med som vårdnadshavare ska inte klassas om.
  update public.profiles
  set guardian_for_name = coalesce(nullif(trim(_child_name), ''), guardian_for_name),
      account_kind = coalesce(account_kind, _account_kind)
  where id = auth.uid();
  return query select * from public.join_team_with_code(_code, _account_kind);
end;
$$;

revoke execute on function public.join_team_with_profile(text, text, text) from anon, public;
grant execute on function public.join_team_with_profile(text, text, text) to authenticated;

create or replace function public.approve_join_with_new_player(_member_id uuid, _player_name text)
returns table(member_role text, linked_player_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  existing uuid;
  new_player uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  select tm.team_id, tm.user_id into m
  from public.team_members tm
  where tm.id = _member_id;
  if m is null then
    raise exception 'Ansökan finns inte.';
  end if;
  if not public.is_team_coach(m.team_id, auth.uid()) then
    raise exception 'Bara lagets ledare kan godkänna ansökningar.';
  end if;
  if nullif(trim(_player_name), '') is null then
    raise exception 'Spelarens namn saknas.';
  end if;
  -- Idempotens per ansökan: en redan kopplad spelare återanvänds,
  -- aldrig deduplicering på namn (två barn kan heta samma sak).
  select p.id into existing
  from public.players p
  where p.member_user_id = m.user_id
    and p.team_id = m.team_id
    and p.is_active
  limit 1;
  if existing is not null then
    return query select * from public.approve_team_join_request(_member_id, existing);
    return;
  end if;
  insert into public.players (user_id, team_id, name, team)
  values (auth.uid(), m.team_id, trim(_player_name), 'home')
  returning id into new_player;
  return query select * from public.approve_team_join_request(_member_id, new_player);
end;
$$;

revoke execute on function public.approve_join_with_new_player(uuid, text) from anon, public;
grant execute on function public.approve_join_with_new_player(uuid, text) to authenticated;