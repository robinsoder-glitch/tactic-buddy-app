-- ETAPP 3: medlemskommunikation

create table if not exists public.team_announcements (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  title text not null,
  body text not null,
  priority text not null default 'normal' check (priority in ('normal','important')),
  audience_type text not null default 'all' check (audience_type in ('all','guardians','players','coaches','event_invited','event_going','event_no_reply','manual')),
  audience_user_ids uuid[] not null default '{}',
  requires_read_receipt boolean not null default false,
  status text not null default 'draft' check (status in ('draft','scheduled','published','cancelled')),
  scheduled_for timestamptz,
  published_at timestamptz,
  publish_error text,
  last_reminder_at timestamptz,
  recipient_count integer not null default 0,
  without_account_count integer not null default 0,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_announcements_team_idx on public.team_announcements(team_id, published_at desc);
create index if not exists team_announcements_sched_idx on public.team_announcements(status, scheduled_for);

grant select, insert, update, delete on public.team_announcements to authenticated;
grant all on public.team_announcements to service_role;
alter table public.team_announcements enable row level security;

create table if not exists public.announcement_recipients (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.team_announcements(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz,
  notification_created_at timestamptz,
  created_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);
create index if not exists announcement_recipients_user_idx on public.announcement_recipients(user_id, read_at);

grant select, update on public.announcement_recipients to authenticated;
grant all on public.announcement_recipients to service_role;
alter table public.announcement_recipients enable row level security;

create table if not exists public.event_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  body text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
create index if not exists event_messages_event_idx on public.event_messages(event_id, created_at);

grant select, insert, update, delete on public.event_messages to authenticated;
grant all on public.event_messages to service_role;
alter table public.event_messages enable row level security;

create table if not exists public.team_chat_reads (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id)
);
grant select, insert, update on public.team_chat_reads to authenticated;
grant all on public.team_chat_reads to service_role;
alter table public.team_chat_reads enable row level security;

-- updated_at-triggers
drop trigger if exists set_team_announcements_updated_at on public.team_announcements;
create trigger set_team_announcements_updated_at before update on public.team_announcements
  for each row execute function public.set_updated_at();
drop trigger if exists set_team_chat_reads_updated_at on public.team_chat_reads;
create trigger set_team_chat_reads_updated_at before update on public.team_chat_reads
  for each row execute function public.set_updated_at();

-- ---------- hjälpfunktioner ----------

-- Får kontot delta i aktivitetens diskussion?
create or replace function public.can_discuss_event(_event_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = _event_id and public.is_team_member(e.team_id, _user_id)
  ) and (
    exists (
      select 1 from public.events e
      where e.id = _event_id and public.is_team_coach(e.team_id, _user_id)
    )
    or exists (
      select 1
      from public.event_invitations i
      join public.players p on p.id = i.player_id
      where i.event_id = _event_id
        and (
          p.member_user_id = _user_id
          or exists (
            select 1 from public.player_guardians g
            where g.player_id = p.id and g.guardian_user_id = _user_id and g.is_active
          )
        )
    )
  );
$$;
revoke all on function public.can_discuss_event(uuid, uuid) from public, anon;
grant execute on function public.can_discuss_event(uuid, uuid) to authenticated, service_role;

-- Mottagare för en målgrupp
create or replace function public.announcement_audience(
  _team_id uuid,
  _event_id uuid,
  _audience_type text,
  _manual uuid[]
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  with event_players as (
    select i.player_id, i.status
    from public.event_invitations i
    where _event_id is not null and i.event_id = _event_id
  ),
  event_users as (
    select distinct u.user_id
    from event_players ep
    join public.players p on p.id = ep.player_id
    cross join lateral (
      select p.member_user_id as user_id
      union all
      select g.guardian_user_id from public.player_guardians g
        where g.player_id = p.id and g.is_active
    ) u
    where u.user_id is not null
      and (
        _audience_type = 'event_invited'
        or (_audience_type = 'event_going' and ep.status = 'going')
        or (_audience_type = 'event_no_reply' and coalesce(ep.status,'no_reply') in ('no_reply','pending'))
      )
  ),
  member_users as (
    select distinct m.user_id
    from public.team_members m
    where m.team_id = _team_id and m.status = 'approved'
      and (
        _audience_type = 'all'
        or (_audience_type = 'coaches' and m.role = 'coach')
        or (_audience_type = 'players' and m.role = 'player')
        or (_audience_type = 'guardians' and m.role = 'guardian')
      )
  ),
  guardian_users as (
    select distinct g.guardian_user_id as user_id
    from public.player_guardians g
    join public.players p on p.id = g.player_id
    where _audience_type = 'guardians' and g.is_active and p.team_id = _team_id
      and g.guardian_user_id is not null
  ),
  manual_users as (
    select distinct m.user_id
    from public.team_members m
    where _audience_type = 'manual' and m.team_id = _team_id and m.status = 'approved'
      and m.user_id = any(coalesce(_manual, '{}'::uuid[]))
  )
  select user_id from member_users
  union
  select user_id from guardian_users
  union
  select user_id from event_users
  union
  select user_id from manual_users;
$$;
revoke all on function public.announcement_audience(uuid, uuid, text, uuid[]) from public, anon;
grant execute on function public.announcement_audience(uuid, uuid, text, uuid[]) to authenticated, service_role;

-- Förhandsvisning av mottagare
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

  create temp table if not exists _aud (user_id uuid primary key) on commit drop;
  delete from _aud;
  insert into _aud (user_id)
    select a.user_id from public.announcement_audience(_team_id, _event_id, _audience_type, _manual) a;

  select count(*) into v_total from _aud;
  select count(*) into v_coaches from _aud a
    join public.team_members m on m.user_id = a.user_id and m.team_id = _team_id and m.status='approved' and m.role='coach';
  select count(*) into v_players from _aud a
    join public.team_members m on m.user_id = a.user_id and m.team_id = _team_id and m.status='approved' and m.role='player';
  select count(*) into v_guardians from _aud a
    where exists (
      select 1 from public.player_guardians g join public.players p on p.id=g.player_id
      where g.guardian_user_id = a.user_id and g.is_active and p.team_id = _team_id
    ) or exists (
      select 1 from public.team_members m where m.user_id=a.user_id and m.team_id=_team_id and m.status='approved' and m.role='guardian'
    );

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
    'recipients', v_total,
    'coaches', v_coaches,
    'players', v_players,
    'guardians', v_guardians,
    'without_account', v_without
  );
end;
$$;
revoke all on function public.preview_announcement_audience(uuid, uuid, text, uuid[]) from public, anon;
grant execute on function public.preview_announcement_audience(uuid, uuid, text, uuid[]) to authenticated;

-- Publicering (idempotent)
create or replace function public.publish_team_announcement(_announcement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.team_announcements%rowtype;
  v_count int := 0;
  v_without int := 0;
begin
  select * into a from public.team_announcements where id = _announcement_id for update;
  if not found then
    raise exception 'Meddelandet finns inte.';
  end if;
  if not public.is_team_coach(a.team_id, auth.uid()) then
    raise exception 'Endast lagets tränare kan publicera meddelanden.';
  end if;
  if a.status = 'published' then
    return jsonb_build_object('recipients', a.recipient_count, 'without_account', a.without_account_count, 'already', true);
  end if;
  if a.status = 'cancelled' then
    raise exception 'Meddelandet är avbrutet.';
  end if;
  if a.event_id is not null and not exists (
    select 1 from public.events e where e.id = a.event_id and e.team_id = a.team_id
  ) then
    raise exception 'Aktiviteten tillhör inte laget.';
  end if;

  insert into public.announcement_recipients (announcement_id, user_id, notification_created_at)
  select _announcement_id, x.user_id, now()
  from public.announcement_audience(a.team_id, a.event_id, a.audience_type, a.audience_user_ids) x
  on conflict (announcement_id, user_id) do nothing;

  get diagnostics v_count = row_count;

  insert into public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by)
  select r.user_id, a.team_id, a.event_id, 'announcement', a.title, left(a.body, 200), a.created_by
  from public.announcement_recipients r
  where r.announcement_id = _announcement_id;

  select count(*) into v_without
  from public.players p
  where p.team_id = a.team_id and coalesce(p.is_active, true)
    and p.member_user_id is null
    and not exists (
      select 1 from public.player_guardians g
      where g.player_id = p.id and g.is_active and g.guardian_user_id is not null
    );

  update public.team_announcements
     set status = 'published',
         published_at = now(),
         publish_error = null,
         recipient_count = v_count,
         without_account_count = v_without
   where id = _announcement_id;

  return jsonb_build_object('recipients', v_count, 'without_account', v_without, 'already', false);
end;
$$;
revoke all on function public.publish_team_announcement(uuid) from public, anon;
grant execute on function public.publish_team_announcement(uuid) to authenticated;

-- Läskvitto
create or replace function public.mark_announcement_read(_announcement_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.announcement_recipients
     set read_at = coalesce(read_at, now())
   where announcement_id = _announcement_id and user_id = auth.uid();
$$;
revoke all on function public.mark_announcement_read(uuid) from public, anon;
grant execute on function public.mark_announcement_read(uuid) to authenticated;

-- Påminn olästa, med dubblettskydd (max en gång per timme)
create or replace function public.remind_unread_announcement(_announcement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.team_announcements%rowtype;
  v_count int := 0;
begin
  select * into a from public.team_announcements where id = _announcement_id for update;
  if not found then raise exception 'Meddelandet finns inte.'; end if;
  if not public.is_team_coach(a.team_id, auth.uid()) then
    raise exception 'Endast lagets tränare kan påminna.';
  end if;
  if a.status <> 'published' then raise exception 'Meddelandet är inte publicerat.'; end if;
  if a.last_reminder_at is not null and a.last_reminder_at > now() - interval '1 hour' then
    return jsonb_build_object('sent', 0, 'skipped', true, 'last_reminder_at', a.last_reminder_at);
  end if;

  insert into public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by)
  select r.user_id, a.team_id, a.event_id, 'announcement_reminder', a.title, 'Påminnelse: du har ett oläst meddelande.', auth.uid()
  from public.announcement_recipients r
  where r.announcement_id = _announcement_id and r.read_at is null;
  get diagnostics v_count = row_count;

  update public.team_announcements set last_reminder_at = now() where id = _announcement_id;
  return jsonb_build_object('sent', v_count, 'skipped', false, 'last_reminder_at', now());
end;
$$;
revoke all on function public.remind_unread_announcement(uuid) from public, anon;
grant execute on function public.remind_unread_announcement(uuid) to authenticated;

-- Schemalagd publicering (körs av serverjobb)
create or replace function public.publish_scheduled_announcements()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_done int := 0;
  v_count int;
  v_without int;
begin
  for r in
    select * from public.team_announcements
    where status = 'scheduled' and scheduled_for is not null and scheduled_for <= now()
    order by scheduled_for
    for update skip locked
  loop
    insert into public.announcement_recipients (announcement_id, user_id, notification_created_at)
    select r.id, x.user_id, now()
    from public.announcement_audience(r.team_id, r.event_id, r.audience_type, r.audience_user_ids) x
    on conflict (announcement_id, user_id) do nothing;
    get diagnostics v_count = row_count;

    insert into public.app_notifications (user_id, team_id, event_id, kind, title, body, created_by)
    select ar.user_id, r.team_id, r.event_id, 'announcement', r.title, left(r.body, 200), r.created_by
    from public.announcement_recipients ar where ar.announcement_id = r.id;

    select count(*) into v_without
    from public.players p
    where p.team_id = r.team_id and coalesce(p.is_active, true) and p.member_user_id is null
      and not exists (select 1 from public.player_guardians g where g.player_id=p.id and g.is_active and g.guardian_user_id is not null);

    update public.team_announcements
       set status='published', published_at = now(), recipient_count = v_count, without_account_count = v_without
     where id = r.id;
    v_done := v_done + 1;
  end loop;
  return v_done;
end;
$$;
revoke all on function public.publish_scheduled_announcements() from public, anon, authenticated;
grant execute on function public.publish_scheduled_announcements() to service_role;

-- ---------- RLS ----------

create policy "Ledare hanterar lagets meddelanden"
  on public.team_announcements for all to authenticated
  using (public.is_team_coach(team_id, auth.uid()) or public.is_platform_admin(auth.uid()))
  with check (public.is_team_coach(team_id, auth.uid()));

create policy "Mottagare läser sina publicerade meddelanden"
  on public.team_announcements for select to authenticated
  using (
    status = 'published' and exists (
      select 1 from public.announcement_recipients r
      where r.announcement_id = id and r.user_id = auth.uid()
    )
  );

create policy "Ledare ser mottagarlistan"
  on public.announcement_recipients for select to authenticated
  using (
    exists (
      select 1 from public.team_announcements a
      where a.id = announcement_id
        and (public.is_team_coach(a.team_id, auth.uid()) or public.is_platform_admin(auth.uid()))
    )
  );

create policy "Mottagaren ser sin egen rad"
  on public.announcement_recipients for select to authenticated
  using (user_id = auth.uid());

create policy "Mottagaren markerar sin egen rad som läst"
  on public.announcement_recipients for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Deltagare läser aktivitetens diskussion"
  on public.event_messages for select to authenticated
  using (public.can_discuss_event(event_id, auth.uid()) or public.is_platform_admin(auth.uid()));

create policy "Deltagare skriver i aktivitetens diskussion"
  on public.event_messages for insert to authenticated
  with check (user_id = auth.uid() and public.can_discuss_event(event_id, auth.uid()));

create policy "Skribent eller ledare ändrar meddelandet"
  on public.event_messages for update to authenticated
  using (
    user_id = auth.uid()
    or public.is_team_coach(team_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  )
  with check (
    user_id = auth.uid()
    or public.is_team_coach(team_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "Skribent eller ledare tar bort meddelandet"
  on public.event_messages for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_team_coach(team_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "Var och en styr sin lässtatus"
  on public.team_chat_reads for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
