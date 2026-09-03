create or replace function public.get_my_day_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  items jsonb := '[]'::jsonb;
  nexts jsonb := '[]'::jsonb;
  news jsonb := '[]'::jsonb;
begin
  if uid is null then
    return jsonb_build_object('todo', items, 'next', nexts, 'news', news);
  end if;

  with my_teams as (
    select m.team_id, m.role, t.name as team_name
    from public.team_members m
    join public.teams t on t.id = m.team_id
    where m.user_id = uid and m.status = 'approved' and t.archived_at is null
  ),
  my_players as (
    select p.id as player_id, p.name as player_name, p.team_id, t.name as team_name, false as is_child
    from public.players p join public.teams t on t.id = p.team_id
    where p.member_user_id = uid
    union
    select p.id, p.name, p.team_id, t.name, true
    from public.player_guardians g
    join public.players p on p.id = g.player_id
    join public.teams t on t.id = p.team_id
    where g.guardian_user_id = uid and g.is_active
  ),
  -- 1 + 3: ändrade eller inställda aktiviteter senaste dygnet
  changed as (
    select jsonb_build_object(
      'kind', case when e.cancelled_at is not null then 'event_cancelled' else 'event_changed' end,
      'priority', 1,
      'team_id', e.team_id, 'team_name', mt.team_name,
      'event_id', e.id, 'player_id', null, 'player_name', null,
      'title', case when e.cancelled_at is not null then 'Aktiviteten är inställd' else 'Aktiviteten har ändrats' end,
      'subtitle', coalesce(e.title, e.type) || ' – ' || to_char(e.starts_at at time zone 'Europe/Stockholm', 'DD Mon HH24:MI'),
      'due_at', e.starts_at,
      'action_url', '/team/' || e.team_id || '/event/' || e.id,
      'action_label', 'Öppna aktiviteten'
    ) as item, e.starts_at as sort_at
    from public.events e
    join my_teams mt on mt.team_id = e.team_id
    where e.starts_at > now()
      and (
        e.cancelled_at > now() - interval '24 hours'
        or exists (select 1 from public.event_change_log l where l.event_id = e.id and l.created_at > now() - interval '24 hours')
      )
  ),
  -- 2 + 8: obesvarade kallelser
  invites as (
    select jsonb_build_object(
      'kind', 'invite_unanswered',
      'priority', case when e.starts_at < now() + interval '3 days' then 2 else 8 end,
      'team_id', e.team_id, 'team_name', mp.team_name,
      'event_id', e.id, 'player_id', mp.player_id, 'player_name', mp.player_name,
      'title', 'Svara på kallelsen' || case when mp.is_child then ' – ' || mp.player_name else '' end,
      'subtitle', coalesce(e.title, e.type) || ' – ' || to_char(e.starts_at at time zone 'Europe/Stockholm', 'DD Mon HH24:MI'),
      'due_at', e.starts_at,
      'action_url', '/mina-kallelser',
      'action_label', 'Svara nu'
    ) as item, e.starts_at as sort_at
    from public.event_invitations i
    join my_players mp on mp.player_id = i.player_id
    join public.events e on e.id = i.event_id
    where i.status = 'pending' and e.cancelled_at is null and e.starts_at > now()
  ),
  -- 3: olästa viktiga meddelanden
  unread_msgs as (
    select jsonb_build_object(
      'kind', 'announcement_unread',
      'priority', 3,
      'team_id', a.team_id, 'team_name', t.name,
      'event_id', a.event_id, 'player_id', null, 'player_name', null,
      'title', 'Läs viktigt meddelande',
      'subtitle', a.title,
      'due_at', a.published_at,
      'action_url', '/meddelanden',
      'action_label', 'Läs meddelandet'
    ) as item, a.published_at as sort_at
    from public.announcement_recipients r
    join public.team_announcements a on a.id = r.announcement_id
    join public.teams t on t.id = a.team_id
    where r.user_id = uid and r.read_at is null and a.status = 'published'
  ),
  -- 4: väntande ansökningar (ledare)
  pending_joins as (
    select jsonb_build_object(
      'kind', 'pending_join',
      'priority', 4,
      'team_id', mt.team_id, 'team_name', mt.team_name,
      'event_id', null, 'player_id', null, 'player_name', null,
      'title', count(*) || ' nya medlemsansökningar',
      'subtitle', mt.team_name,
      'due_at', min(m.created_at),
      'action_url', '/team/' || mt.team_id || '/leaders',
      'action_label', 'Granska ansökningar'
    ) as item, min(m.created_at) as sort_at
    from my_teams mt
    join public.team_members m on m.team_id = mt.team_id and m.status = 'pending'
    where mt.role in ('coach','head_coach','club_admin')
    group by mt.team_id, mt.team_name
  ),
  -- 5: pågående träningsgenomförande
  runs as (
    select jsonb_build_object(
      'kind', 'session_run',
      'priority', 5,
      'team_id', r.team_id, 'team_name', mt.team_name,
      'event_id', r.event_id, 'player_id', null, 'player_name', null,
      'title', 'Pågående träning',
      'subtitle', 'Du har ett träningsgenomförande som inte är avslutat.',
      'due_at', r.started_at,
      'action_url', '/traningspass/' || r.session_id || '/genomfor',
      'action_label', 'Fortsätt träningen'
    ) as item, r.started_at as sort_at
    from public.session_runs r
    join my_teams mt on mt.team_id = r.team_id
    where r.coach_id = uid and r.status in ('running','paused')
  ),
  -- 6: kommande aktivitet med ofärdig planering (ledare)
  unplanned as (
    select jsonb_build_object(
      'kind', 'planning_missing',
      'priority', 6,
      'team_id', e.team_id, 'team_name', mt.team_name,
      'event_id', e.id, 'player_id', null, 'player_name', null,
      'title', case when e.type = 'match' then 'Planera matchen' else 'Planera träningen' end,
      'subtitle', coalesce(e.title, e.type) || ' – ' || to_char(e.starts_at at time zone 'Europe/Stockholm', 'DD Mon HH24:MI'),
      'due_at', e.starts_at,
      'action_url', '/team/' || e.team_id || '/event/' || e.id,
      'action_label', 'Öppna planeringen'
    ) as item, e.starts_at as sort_at
    from public.events e
    join my_teams mt on mt.team_id = e.team_id
    where mt.role in ('coach','head_coach','club_admin')
      and e.cancelled_at is null
      and e.starts_at between now() and now() + interval '10 days'
      and not exists (select 1 from public.event_plans p where p.event_id = e.id and p.planning_done)
  ),
  -- 7: passerad aktivitet utan närvaro (ledare)
  missing_attendance as (
    select jsonb_build_object(
      'kind', 'attendance_missing',
      'priority', 7,
      'team_id', e.team_id, 'team_name', mt.team_name,
      'event_id', e.id, 'player_id', null, 'player_name', null,
      'title', 'Registrera närvaro',
      'subtitle', coalesce(e.title, e.type) || ' – ' || to_char(e.starts_at at time zone 'Europe/Stockholm', 'DD Mon HH24:MI'),
      'due_at', e.starts_at,
      'action_url', '/team/' || e.team_id || '/narvaro',
      'action_label', 'Registrera närvaro'
    ) as item, e.starts_at as sort_at
    from public.events e
    join my_teams mt on mt.team_id = e.team_id
    where mt.role in ('coach','head_coach','club_admin')
      and e.cancelled_at is null
      and e.starts_at between now() - interval '14 days' and now()
      and not exists (select 1 from public.event_attendance a where a.event_id = e.id)
  ),
  todo as (
    select * from changed
    union all select * from invites
    union all select * from unread_msgs
    union all select * from pending_joins
    union all select * from runs
    union all select * from unplanned
    union all select * from missing_attendance
  )
  select coalesce(jsonb_agg(item order by (item->>'priority')::int, sort_at nulls last), '[]'::jsonb)
  into items from todo;

  select coalesce(jsonb_agg(x order by (x->>'starts_at')), '[]'::jsonb) into nexts
  from (
    select jsonb_build_object(
      'event_id', e.id, 'team_id', e.team_id, 'team_name', t.name,
      'type', e.type, 'title', coalesce(e.title, e.type),
      'starts_at', e.starts_at, 'meet_at', e.meet_at, 'location', e.location,
      'action_url', '/team/' || e.team_id || '/event/' || e.id
    ) as x
    from public.events e
    join public.teams t on t.id = e.team_id
    where e.cancelled_at is null and e.starts_at > now()
      and exists (
        select 1 from public.team_members m
        where m.team_id = e.team_id and m.user_id = uid and m.status = 'approved'
      )
    order by e.starts_at
    limit 3
  ) q;

  select coalesce(jsonb_agg(x order by (x->>'created_at') desc), '[]'::jsonb) into news
  from (
    select jsonb_build_object(
      'kind', n.kind, 'title', n.title, 'body', n.body,
      'created_at', n.created_at, 'team_id', n.team_id, 'event_id', n.event_id,
      'read_at', n.read_at
    ) as x
    from public.app_notifications n
    where n.user_id = uid and n.created_at > now() - interval '14 days'
    order by n.created_at desc
    limit 8
  ) q2;

  return jsonb_build_object('todo', items, 'next', nexts, 'news', news);
end;
$$;

revoke all on function public.get_my_day_summary() from public, anon;
grant execute on function public.get_my_day_summary() to authenticated;
