create or replace function public.is_announcement_recipient(_announcement_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.announcement_recipients r
    where r.announcement_id = _announcement_id and r.user_id = _user_id
  );
$$;
revoke all on function public.is_announcement_recipient(uuid, uuid) from public, anon;
grant execute on function public.is_announcement_recipient(uuid, uuid) to authenticated, service_role;

create or replace function public.announcement_team(_announcement_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select a.team_id from public.team_announcements a where a.id = _announcement_id;
$$;
revoke all on function public.announcement_team(uuid) from public, anon;
grant execute on function public.announcement_team(uuid) to authenticated, service_role;

drop policy if exists "Mottagare läser sina publicerade meddelanden" on public.team_announcements;
create policy "Mottagare läser sina publicerade meddelanden"
  on public.team_announcements for select to authenticated
  using (status = 'published' and public.is_announcement_recipient(id, auth.uid()));

drop policy if exists "Ledare ser mottagarlistan" on public.announcement_recipients;
create policy "Ledare ser mottagarlistan"
  on public.announcement_recipients for select to authenticated
  using (
    public.is_team_coach(public.announcement_team(announcement_id), auth.uid())
    or public.is_platform_admin(auth.uid())
  );
