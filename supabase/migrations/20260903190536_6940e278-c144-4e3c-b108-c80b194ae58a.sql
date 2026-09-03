create or replace function public.preview_announcement_audience(
  _team_id uuid,
  _event_id uuid,
  _audience_type text,
  _manual uuid[] default '{}'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_total int;
  v_guardians int;
  v_players int;
  v_coaches int;
  v_without int;
begin
  if not public.is_team_coach(_team_id, auth.uid()) then
    raise exception 'Endast lagets tränare kan skicka meddelanden.';
  end if;
  if _event_id is not null and not exists (
    select 1 from public.events e where e.id = _event_id and e.team_id = _team_id
  ) then
    raise exception 'Aktiviteten tillhör inte laget.';
  end if;
  if _audience_type in ('event_invited','event_going','event_no_reply') and _event_id is null then
    raise exception 'Välj en aktivitet för den här målgruppen.';
  end if;

  select
    count(*),
    count(*) filter (where exists (
      select 1 from public.team_members m
      where m.user_id = a.user_id and m.team_id = _team_id and m.status='approved' and m.role='coach')),
    count(*) filter (where exists (
      select 1 from public.team_members m
      where m.user_id = a.user_id and m.team_id = _team_id and m.status='approved' and m.role='player')),
    count(*) filter (where exists (
      select 1 from public.player_guardians g join public.players p on p.id = g.player_id
      where g.guardian_user_id = a.user_id and g.is_active and p.team_id = _team_id)
      or exists (
      select 1 from public.team_members m
      where m.user_id = a.user_id and m.team_id = _team_id and m.status='approved' and m.role='guardian'))
  into v_total, v_coaches, v_players, v_guardians
  from public.announcement_audience(_team_id, _event_id, _audience_type, _manual) a;

  select count(*) into v_without
  from public.players p
  where p.team_id = _team_id and coalesce(p.is_active, true)
    and p.member_user_id is null
    and not exists (
      select 1 from public.player_guardians g
      where g.player_id = p.id and g.is_active and g.guardian_user_id is not null
    )
    and (
      _event_id is null
      or exists (select 1 from public.event_invitations i where i.event_id=_event_id and i.player_id=p.id)
    );

  return jsonb_build_object(
    'recipients', coalesce(v_total,0),
    'coaches', coalesce(v_coaches,0),
    'players', coalesce(v_players,0),
    'guardians', coalesce(v_guardians,0),
    'without_account', coalesce(v_without,0)
  );
end;
$$;
revoke all on function public.preview_announcement_audience(uuid, uuid, text, uuid[]) from public, anon;
grant execute on function public.preview_announcement_audience(uuid, uuid, text, uuid[]) to authenticated;
