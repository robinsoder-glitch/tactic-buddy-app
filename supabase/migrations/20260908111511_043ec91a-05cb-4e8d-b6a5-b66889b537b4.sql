alter publication supabase_realtime add table public.team_chat_messages;
alter publication supabase_realtime add table public.event_messages;
alter publication supabase_realtime add table public.app_notifications;
alter table public.team_chat_messages replica identity full;
alter table public.event_messages replica identity full;
alter table public.app_notifications replica identity full;