ALTER TABLE public.app_notifications DROP CONSTRAINT app_notifications_created_by_fkey;
ALTER TABLE public.app_notifications ADD CONSTRAINT app_notifications_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_attendance DROP CONSTRAINT event_attendance_created_by_fkey;
ALTER TABLE public.event_attendance ADD CONSTRAINT event_attendance_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.event_change_log DROP CONSTRAINT event_change_log_changed_by_fkey;
ALTER TABLE public.event_change_log ADD CONSTRAINT event_change_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_invitation_log DROP CONSTRAINT event_invitation_log_changed_by_fkey;
ALTER TABLE public.event_invitation_log ADD CONSTRAINT event_invitation_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_invitations DROP CONSTRAINT event_invitations_created_by_fkey;
ALTER TABLE public.event_invitations ADD CONSTRAINT event_invitations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.event_invitations DROP CONSTRAINT event_invitations_responded_by_fkey;
ALTER TABLE public.event_invitations ADD CONSTRAINT event_invitations_responded_by_fkey FOREIGN KEY (responded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.event_invitations DROP CONSTRAINT event_invitations_revoked_by_fkey;
ALTER TABLE public.event_invitations ADD CONSTRAINT event_invitations_revoked_by_fkey FOREIGN KEY (revoked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_plans DROP CONSTRAINT event_plans_created_by_fkey;
ALTER TABLE public.event_plans ADD CONSTRAINT event_plans_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.event_resources DROP CONSTRAINT event_resources_created_by_fkey;
ALTER TABLE public.event_resources ADD CONSTRAINT event_resources_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.event_squad DROP CONSTRAINT event_squad_created_by_fkey;
ALTER TABLE public.event_squad ADD CONSTRAINT event_squad_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.kb_articles DROP CONSTRAINT kb_articles_created_by_fkey;
ALTER TABLE public.kb_articles ADD CONSTRAINT kb_articles_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.match_lineups DROP CONSTRAINT match_lineups_created_by_fkey;
ALTER TABLE public.match_lineups ADD CONSTRAINT match_lineups_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.match_shares DROP CONSTRAINT match_shares_created_by_fkey;
ALTER TABLE public.match_shares ADD CONSTRAINT match_shares_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.player_guardians DROP CONSTRAINT player_guardians_created_by_fkey;
ALTER TABLE public.player_guardians ADD CONSTRAINT player_guardians_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.player_stats DROP CONSTRAINT player_stats_created_by_fkey;
ALTER TABLE public.player_stats ADD CONSTRAINT player_stats_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.team_photos DROP CONSTRAINT team_photos_created_by_fkey;
ALTER TABLE public.team_photos ADD CONSTRAINT team_photos_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;