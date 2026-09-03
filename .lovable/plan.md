# Global admin för hela Fotbollsrummet

Idag finns en enkel adminsida (`/admin`) som bara listar lag, men ingen användare har adminrollen och databasen tillåter i praktiken bara läsning av lag och profiler för admin. Inget går att ändra. Planen gör dig till riktig plattformsadmin med full insyn och full redigering.

## Vad du får

**1. Ditt konto blir admin**
- Adminrollen kopplas till robin@eckersundsoderadvokater.se (kräver att kontot är skapat och e-posten bekräftad i appen).
- Rollen ligger kvar i den separata rollstabellen — aldrig på profilen.

**2. Ny adminpanel med flikar**
- **Översikt**: antal klubbar, lag, konton, spelare, aktiviteter.
- **Konton**: alla registrerade användare med e-post, namn, registreringsdatum, senaste inloggning, roller och lagtillhörighet — även konton utan lag. Sökbar lista. Här kan du ge/ta bort global admin och radera ett konto med allt dess data.
- **Lag & klubbar**: alla lag, oavsett om du är medlem. Öppna ett lag → redigera namn, klubb, åldersgrupp, kön, hemmaplan, anslutningskoder, arkivera eller radera laget.
- **Medlemmar (per lag)**: se vilka som anslutit, godkänn/avvisa väntande, byta roll (tränare/spelare), ta bort medlem, redigera och ta bort spelare i truppen.
- **Innehåll**: aktiviteter, taktiker, övningar och artiklar per lag med möjlighet att ta bort.

**3. Admin kan se och ändra allt i appen**
- Alla befintliga lagsidor (kalender, trupp, närvaro, matchplanering, taktik osv.) öppnas för admin även utan medlemskap, så du kan gå in i ett lag och rätta saker på plats i vanliga vyn.

**4. Säkerhet**
- All adminåtkomst kontrolleras i databasen, inte bara i gränssnittet.
- Radering och kontolistning sker via serverfunktioner som först verifierar att den som anropar verkligen är admin.
- Farliga åtgärder (radera lag/konto) kräver bekräftelse där du skriver namnet.
- Alla adminåtgärder loggas i en enkel händelselogg med vem, vad och när.

## Tekniskt genomförande

**Migrationer**
- `public.is_platform_admin(_user_id uuid)` — security definer, `has_role(_user_id,'admin')`.
- Admin-policyer (SELECT + INSERT/UPDATE/DELETE) på: `clubs`, `teams`, `team_members`, `players`, `player_guardians`, `player_stats`, `events`, `event_*`, `match_lineups`, `match_shares`, `coach_sessions`, `coach_session_items`, `coach_drills`, `session_run*`, `team_periods`, `period_*`, `player_focus_areas`, `player_observations`, `team_photos`, `team_chat_messages`, `team_invites`, `tactics`, `tactic_frames`, `content_links`, `app_notifications`, `profiles`, `user_roles`. Befintliga icke-admin-policyer lämnas orörda.
- `user_roles` får admin-hanterade INSERT/DELETE-policyer (idag helt låst).
- Trigger `grant_admin_for_verified_email` på `auth.users` (insert + e-postbekräftelse) som ger adminrollen till den angivna adressen endast när `email_confirmed_at` är satt; körs även retroaktivt i migrationen om kontot redan finns och är bekräftat.
- Ny tabell `public.admin_audit_log` (actor_id, action, target_type, target_id, details jsonb, created_at) med GRANT + RLS: bara admin läser, skrivs av serverfunktioner.

**Serverfunktioner** (`src/lib/admin.functions.ts`, `createServerFn` + `requireSupabaseAuth`, verifierar `has_role(... ,'admin')` innan `supabaseAdmin` laddas i handlern)
- `listAccounts` — auth-admin API: e-post, skapad, senaste inloggning + join mot profiler/roller/medlemskap.
- `setAdminRole` — ge/ta bort admin (kan inte ta bort din egen sista adminroll).
- `deleteAccount` — raderar auth-användaren och rensar beroende rader.
- `deleteTeam` — raderar lag med allt innehåll.
- Alla skriver rad i `admin_audit_log`.

**Frontend**
- `/admin` byggs om till layout med flikar: `admin.index.tsx` (översikt), `admin.konton.tsx`, `admin.lag.tsx`, `admin.lag.$teamId.tsx`, `admin.innehall.tsx`.
- Adminlänk i `AppNav.tsx` visas bara när `useAccount().isAdmin`.
- Klientsidiga behörighetskontroller (t.ex. `photo-access.ts`, lagsidor som kräver medlemskap) släpper igenom admin.
- Bekräftelsedialog med namninmatning för radering; Zod-validering på alla adminformulär.

**Verifiering**
- Enhetstester för behörighetslogik, typkontroll och full testsvit.
- Livetest: logga in som admin, öppna ett lag du inte är medlem i, ändra lagnamn, byt roll på en medlem, kontrollera kontolistan; samt negativt test att en icke-admin får 403.
