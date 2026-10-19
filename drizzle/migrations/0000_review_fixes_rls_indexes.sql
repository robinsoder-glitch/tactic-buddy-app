-- Fynd 2: ledare ska kunna ändra varandras poster. FOR ALL-policyerna ersätts
-- med separata policyer så att created_by bara kontrolleras vid INSERT.
DROP POLICY IF EXISTS "Tranare hanterar ansvariga tranare" ON public.event_coaches;
CREATE POLICY "Tranare lagger till ansvariga tranare" ON public.event_coaches FOR INSERT TO authenticated
  WITH CHECK (is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Tranare uppdaterar ansvariga tranare" ON public.event_coaches FOR UPDATE TO authenticated
  USING (is_team_coach(team_id, auth.uid())) WITH CHECK (is_team_coach(team_id, auth.uid()));
CREATE POLICY "Tranare tar bort ansvariga tranare" ON public.event_coaches FOR DELETE TO authenticated
  USING (is_team_coach(team_id, auth.uid()));

DROP POLICY IF EXISTS "coaches manage event resources" ON public.event_resources;
CREATE POLICY "coaches insert event resources" ON public.event_resources FOR INSERT TO authenticated
  WITH CHECK (is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "coaches update event resources" ON public.event_resources FOR UPDATE TO authenticated
  USING (is_team_coach(team_id, auth.uid())) WITH CHECK (is_team_coach(team_id, auth.uid()));
CREATE POLICY "coaches delete event resources" ON public.event_resources FOR DELETE TO authenticated
  USING (is_team_coach(team_id, auth.uid()));

DROP POLICY IF EXISTS "coaches manage event squad" ON public.event_squad;
CREATE POLICY "coaches insert event squad" ON public.event_squad FOR INSERT TO authenticated
  WITH CHECK (is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "coaches update event squad" ON public.event_squad FOR UPDATE TO authenticated
  USING (is_team_coach(team_id, auth.uid())) WITH CHECK (is_team_coach(team_id, auth.uid()));
CREATE POLICY "coaches delete event squad" ON public.event_squad FOR DELETE TO authenticated
  USING (is_team_coach(team_id, auth.uid()));

DROP POLICY IF EXISTS "coaches manage photos" ON public.team_photos;
CREATE POLICY "coaches insert photos" ON public.team_photos FOR INSERT TO authenticated
  WITH CHECK (is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "coaches update photos" ON public.team_photos FOR UPDATE TO authenticated
  USING (is_team_coach(team_id, auth.uid())) WITH CHECK (is_team_coach(team_id, auth.uid()));
CREATE POLICY "coaches delete photos" ON public.team_photos FOR DELETE TO authenticated
  USING (is_team_coach(team_id, auth.uid()));

-- team_invites saknade egen läspolicy för ledare (den låg i FOR ALL).
DROP POLICY IF EXISTS "Coaches manage team invites" ON public.team_invites;
CREATE POLICY "Coaches read team invites" ON public.team_invites FOR SELECT TO authenticated
  USING (is_team_coach(team_id, auth.uid()));
CREATE POLICY "Coaches create team invites" ON public.team_invites FOR INSERT TO authenticated
  WITH CHECK (is_team_coach(team_id, auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Coaches update team invites" ON public.team_invites FOR UPDATE TO authenticated
  USING (is_team_coach(team_id, auth.uid())) WITH CHECK (is_team_coach(team_id, auth.uid()));
CREATE POLICY "Coaches delete team invites" ON public.team_invites FOR DELETE TO authenticated
  USING (is_team_coach(team_id, auth.uid()));

-- Fynd 3: författaren får alltid ta bort/ändra sitt eget, ledare får moderera.
DROP POLICY IF EXISTS "Authors delete own messages" ON public.team_chat_messages;
CREATE POLICY "Authors delete own messages" ON public.team_chat_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR is_team_coach(team_id, auth.uid()));
DROP POLICY IF EXISTS "Authors update own messages" ON public.team_chat_messages;
CREATE POLICY "Authors update own messages" ON public.team_chat_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_team_coach(team_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() OR is_team_coach(team_id, auth.uid()));

-- Fynd 4: begränsa storleken på anonyma flödeshändelser.
ALTER TABLE public.invite_flow_events
  ADD CONSTRAINT invite_flow_events_event_len CHECK (length(event) <= 200),
  ADD CONSTRAINT invite_flow_events_team_code_len CHECK (team_code IS NULL OR length(team_code) <= 200),
  ADD CONSTRAINT invite_flow_events_role_len CHECK (role IS NULL OR length(role) <= 200),
  ADD CONSTRAINT invite_flow_events_path_len CHECK (path IS NULL OR length(path) <= 200),
  ADD CONSTRAINT invite_flow_events_details_size CHECK (octet_length(details::text) <= 2048);
CREATE INDEX IF NOT EXISTS invite_flow_events_created_idx ON public.invite_flow_events (created_at);

-- Fynd 5: saknade index.
CREATE INDEX IF NOT EXISTS events_team_starts_idx ON public.events (team_id, starts_at);
CREATE INDEX IF NOT EXISTS event_invitations_team_idx ON public.event_invitations (team_id);
CREATE INDEX IF NOT EXISTS team_invites_team_idx ON public.team_invites (team_id);
CREATE INDEX IF NOT EXISTS match_lineups_team_idx ON public.match_lineups (team_id);
CREATE INDEX IF NOT EXISTS player_guardians_guardian_idx ON public.player_guardians (guardian_user_id);
CREATE INDEX IF NOT EXISTS team_chat_messages_team_created_idx ON public.team_chat_messages (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_messages_team_idx ON public.event_messages (team_id);
CREATE INDEX IF NOT EXISTS players_member_user_idx ON public.players (member_user_id);

-- Fynd 6: dubbelt unikt index (ingen FK pekar på någon av dem).
ALTER TABLE public.event_attendance DROP CONSTRAINT IF EXISTS event_attendance_event_player_key;