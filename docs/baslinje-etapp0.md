# Baslinje inför roadmapen (Etapp 0)

Datum: 3 september 2026. Inga användarflöden och ingen produktionsdata har ändrats i denna etapp.

## 1. Routes och deras datakällor

| Route | Syfte | Tabeller och funktioner |
| --- | --- | --- |
| `/` | Publik startsida | – |
| `/auth`, `/reset-password` | Inloggning, registrering, återställning | `auth`, `find_team_by_code`, `join_team_with_code`, `profiles`, `team_members` |
| `/_authenticated/onboarding` | Slutför registrering efter e-postbekräftelse | `profiles`, `team_members`, `players`, `player_guardians`, `find_team_by_code`, `join_team_with_code` |
| `/teams` | Mina lag, skapa lag, byt lag | `teams`, `team_members`, `clubs`, `profiles` |
| `/team/$teamId` | Lagets startsida | `teams`, `team_members`, `players`, `events` |
| `/team/$teamId/calendar`, `/kalender` | Kalender | `events`, `event_invitations`, `teams` |
| `/team/$teamId/event/$eventId` | Aktivitetssida (etapp 1:s nav) | `events`, `event_invitations`, `event_squad`, `event_coaches`, `event_plans`, `event_resources`, `event_attendance`, `match_lineups`, `save_match_plan`, `save_training_plan` |
| `/kalender/kallelser` | Mina kallelser och svar | `event_invitations`, `players`, `player_guardians`, `event_invitation_log`, `send_invite_reminders` |
| `/team/$teamId/narvaro` | Närvaro och speltid | `event_attendance`, `event_invitations`, `players`, `session_run_attendance` |
| `/team/$teamId/leaders` | Ledare, godkännanden, koder | `team_members`, `team_invites`, `accept_team_invite`, `rotate_team_code`, `profiles` |
| `/inbjudan/$token` | Inbjudningslänk | `team_invites`, `accept_team_invite`, `teams` |
| `/team/$teamId/player/$playerId` | Spelarkort och statistik | `players`, `player_stats`, `player_focus_areas`, `player_observations`, `player_guardians` |
| `/team/$teamId/tranarsnack`, `/tranarsnack` | Tränarnas interna dialog | `team_chat_messages`, `team_members`, `profiles` |
| `/planera-traning`, `/traningspass/$id/*` | Träningspass och genomförande | `coach_sessions`, `coach_session_items`, `coach_drills`, `session_runs`, `session_run_items`, `session_run_attendance`, `session_run_player_notes` |
| `/planera-match` | Matchplanering | `events`, `match_lineups`, `event_squad`, `event_coaches`, `save_match_plan` |
| `/taktik`, `/tactic/$id`, `/t/$shareId`, `/delad-match/$token` | Taktiktavla och delning | `tactics`, `tactic_frames`, `match_shares`, `get_shared_match` |
| `/taktikbank/*`, `/bank`, `/kunskapsbank/*` | Kunskaps- och övningsbanker | `tb_*`-tabeller, `knowledge_articles`, `content_links`, `tb_favorites` |
| `/team/$teamId/photos` | Lagbilder | `team_photos`, storage |
| `/installningar` | Inställningar och profil | `profiles`, `user_roles`, lokala inställningar |
| `/admin/*` | Plattformsadmin | `admin_audit_log`, `user_roles`, `has_role`, serverfunktioner med servicenyckel |

## 2. Beteenden som ska bevaras

- Två kodtyper: spelarkod (`teams.join_code`) för spelare och vårdnadshavare, tränarkod (`teams.coach_join_code`) för tränare. Alltid exakt sex tecken, normaliserade med `trim().toUpperCase()`.
- `profiles.display_name` är den vuxnes namn. Barnets namn ligger separat och kopplas via `player_guardians`.
- Hälsningen använder namnet, aldrig e-postadressen.
- Rollstyrd navigation: spelare och vårdnadshavare ser Kalender, Mitt lag, Kunskap och Inställningar.
- Matchens taktikkoppling är oförändrad (endast `match_lineups.tactic_id`).

## 3. Avgränsning – punkt 7

Förbättring 7, hårdare koppling mellan taktiktavlan och matchen, ska inte byggas. Regressionstestet i
`src/test/baseline.test.ts` bevakar att `src/lib/match-plan.ts` bara innehåller den befintliga
`tactic_id`-kopplingen, att inga nya taktikversioner eller frames skapas från matchplanen och att
laguppställningens sparade fält är oförändrade.

## 4. Testdata

`src/test/fixtures.ts` beskriver den uppsättning konton och aktiviteter som ska användas genom hela
roadmapen: Lag A och Lag B, en tränare i varje lag, en tränare som väntar på godkännande, en spelare
med eget konto, en spelare utan konto, en vårdnadshavare med ett barn, en vårdnadshavare med två barn
i olika lag, ett konto som både är tränare och vårdnadshavare, kommande träning, kommande match,
tidigare träning, inställd aktivitet, alla fyra kallelsestatusar samt aktiviteter med och utan närvaro.

## 5. Hemligheter

`.env` innehåller endast publika värden (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`,
`VITE_SUPABASE_PROJECT_ID` och motsvarande serverkopior). Servicenyckeln läses endast i
`src/integrations/supabase/client.server.ts` via `process.env` och skickas aldrig till klienten.
Inga hemliga värden har skrivits ut i loggar.

## 6. Baslinjeresultat

- Vitest: 32 filer, 325 tester gröna.
- TypeScript: inga fel.
- Build: grön.
- Lint: 0 fel, 15 kända varningar av typen `react-refresh/only-export-components`. Inga nya varningar tillkom.
