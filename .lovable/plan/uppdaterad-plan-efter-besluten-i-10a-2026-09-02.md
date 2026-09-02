# Uppdaterad plan efter besluten i 10A

## Sammanfattning av läget

| Beslut | Nuläge i appen | Konflikt? |
| --- | --- | --- |
| Speltid i minuter | Finns inte alls. `event_attendance` har bara status + note. `events` saknar matchlängd. | Nej, bara saknad funktion |
| `kb_articles` avvecklas | Tabellen är **tom (0 rader)**. `knowledge_articles` har 100 publicerade artiklar och används av kunskapsbanken. `src/lib/kunskapsbank.ts` (adminvy) läser/skriver fortfarande mot `kb_articles`. | Ja – två källor i koden, men ingen data att migrera |
| Tränarsnack alltid lagbundet | `team_chat_messages.team_id` är redan obligatoriskt med lagbunden RLS. `/tranarsnack` är redan en översikt över användarens lag. | Nej – matchar beslutet |
| Dubbletter av namn tillåts med varning | Inget unikt namnindex finns (bra). Ingen varning vid liknande namn. Uttagning använder `player_id`. | Nej, bara saknad varning |
| Vem får registrera närvaro | Endast roll `coach` i laget (`is_team_coach`) kan skriva. Ingen lagledarbehörighet. `event_attendance` saknar unik nyckel på (event, spelare) och saknar `updated_by`. | Ja – saknad unik nyckel är en verklig buggrisk |

## Påverkade tabeller och komponenter

- **Speltid:** `events`, `event_attendance`; `src/lib/attendance.ts`, `team.$teamId.narvaro.tsx`, `planera-match.tsx`, `team.$teamId.event.$eventId.tsx`, spelarprofil/statistik.
- **Kunskapsbank:** `kb_articles` (avvecklas), `knowledge_articles` (huvudtabell); `src/lib/kunskapsbank.ts`, `src/lib/knowledge.ts`, `admin.tsx`, `kunskapsbank.*`.
- **Närvaro/behörighet:** `team_members`, `event_attendance`, funktionerna `is_team_coach`/`is_team_member`; närvarovyer och kallelsevyer.
- **Trupp:** `players`, spelarformuläret i `team.$teamId.index.tsx`.
- **Tränarsnack:** endast UI-komplettering i `tranarsnack.tsx` / `TeamChatPanel.tsx` (lagfärg, filter, tydlig avsändare).

## Migrationer som behövs (icke-destruktiva)

1. `events`: ny kolumn `match_duration_minutes int` (nullbar, validering > 0 via trigger).
2. `event_attendance`:
   - `minutes_played int` (nullbar, >= 0, får ej överstiga matchlängd – valideras i trigger, inte CHECK),
   - `registered_by uuid`, `registered_at timestamptz`, `updated_by uuid`,
   - **unik constraint `(event_id, player_id)`** så att ändrad närvaro uppdaterar samma post,
   - utökad statusdomän: `present`, `absent`, `partial` (del av aktiviteten), `unregistered`; befintliga `late`/`sick` mappas till `partial`/`absent` i ett datasteg, med behållen `note`.
   - `playing_time_share` lagras **inte** – beräknas i vyn/koden som `minutes_played / match_duration_minutes`.
3. `team_members`: ny kolumn `can_manage_attendance boolean not null default false` samt ny funktion `public.can_manage_attendance(_team_id, _user_id)` = tränare i laget ELLER medlem med flaggan ELLER `has_role(uid,'admin')`.
4. Unik constraint på `player_stats (player_id, competition)` för att undvika dubbletter.
5. Index: `event_attendance (event_id)` finns; lägg `players (team_id, lower(name))` för snabb dubblettvarning.

## Migrationer som är destruktiva och ska vänta

- `DROP TABLE public.kb_articles` – görs först i en separat, senare migration när koden inte längre refererar tabellen och backup är tagen. I detta steg sätts den i read-only (behåll SELECT-policy, ta bort INSERT/UPDATE/DELETE-policyer och skrivgrants).
- Borttagning av gamla statusvärden (`late`, `sick`) ur närvarodata – görs efter att UI:t skrivits om och data konverterats.
- Eventuell sammanslagning av dubbla spelarposter – kräver manuell granskning, ingår inte.

## RLS-policyer som skapas/ändras

- `event_attendance`: skriv-policyer byts från `is_team_coach(...)` till `can_manage_attendance(...)`. Läspolicy: lagmedlemmar ser sitt lag; vårdnadshavare/spelare ser endast rader för sina egna kopplade spelare (`is_my_player`). Ingen åtkomst över lagsgräns.
- `events`: befintliga policyer räcker; `match_duration_minutes` skrivs av tränare.
- `team_members`: endast tränare i laget får sätta `can_manage_attendance`.
- `kb_articles`: skrivpolicyer tas bort (read-only för admin).
- `knowledge_articles`: adminroll får skapa/redigera/publicera; publik läsning endast för `is_published`.
- Speltid exponeras aldrig i publika delningsvyer (`/t/$shareId` rör inte närvaro).

## Gränssnitt som byggs efter migrationerna

- Närvarovy: statusknappar (Närvarande / Frånvarande / Del av aktiviteten / Ej registrerad) + speltidsval Hela, ~3/4, ~1/2, ~1/4, Exakta minuter. Snabbval kräver registrerad matchlängd, annars fråga om längd först.
- Förifyllt förslag från kallelsesvar ”Kommer”, men ledaren fastställer närvaron.
- Dubblettvarning vid ny spelare med samma/liknande namn i laget, med valen Visa befintlig spelare / Avbryt / Skapa ändå.
- Tränarsnack-inkorg: lagnamn och färg, senaste meddelande, olästa, tidpunkt, avsändare, filter per lag.

## Ordning

1. Migration 1–5 (icke-destruktiva) + RLS-ändringar.
2. Flytta admin-kunskapsbanken till `knowledge_articles`, sätt `kb_articles` read-only.
3. Bygg närvaro-/speltids-UI och dubblettvarning.
4. Tränarsnack-inkorgens komplettering.
5. Senare separat migration: ta bort `kb_articles`.
