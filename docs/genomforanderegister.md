# Genomföranderegister – Fotbollsrummet

Baslinje upprättad 2026-09-08 (steg 00). Registret följer stegnumren i den inklistrade
roadmapen (steg 00–14 samt E1) och är den enda platsen där status för dessa steg förs.

## 1. Verifierad baslinje (kod och miljö)

| Kontroll                           | Resultat                                                                                                                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vitest                             | 55 filer, 491 tester – gröna                                                                                                                                                     |
| TypeScript (`tsgo --noEmit`)       | Utan fel                                                                                                                                                                         |
| Produktionsbygge (`bun run build`) | Lyckas                                                                                                                                                                           |
| ESLint                             | 0 fel, 17 varningar (samtliga `react-refresh/only-export-components`)                                                                                                            |
| Prettier                           | Rättat `src/lib/event-labels.test.ts`. Kvar: `src/integrations/supabase/types.ts`, `previewAuthStorage.ts` (autogenererade, ändras ej), `src/routes/README.md`, `src/styles.css` |
| Installerade migrationer           | 91 st, senaste `20260908183547`                                                                                                                                                  |
| Frontendversion i testmiljön       | Okänd – förhandsvisningen byggs om per ändring; ingen versionsmarkör kopplad till installerad databasversion                                                                     |

Datainnehåll i databasen just nu: 112 publicerade kunskapsartiklar, 20 taktikkort,
14 bankövningar, 3 bankpass, 2 egna träningspass, 0 passgenomföranden, 43 innehållslänkar,
0 periodplaner, 0 favoriter, 4 kvittensrader för idempotenta operationer.

## 2. Dataklassning och referenser

| Typ                                                               | Tabeller                                                                                                                                                                                                                                  | Referens                                                                                 |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Redaktionellt bankinnehåll (läs för alla inloggade, skrivskyddat) | `tb_drills`, `tb_tactics`, `tb_training_sessions`, `tb_formations`, `tb_rulesets`, `tb_goalkeeper_cards`, `tb_district_profiles`, `tb_taxonomy`, `knowledge_articles`                                                                     | Text-ID (`t01_…`, `KB042`) som refereras som `resource_id` + `kind`                      |
| Privat användarinnehåll                                           | `coach_sessions`, `coach_session_items`, `coach_drills`, `tactics`, `tactic_frames`, `tb_favorites`                                                                                                                                       | `user_id`; `coach_session_items.resource_id` pekar antingen på bank-ID eller egen övning |
| Laginnehåll                                                       | `events`, `event_resources`, `event_plans`, `event_squad`, `event_invitations`, `event_attendance`, `match_lineups`, `team_periods`, `period_links`, `session_runs`, `session_run_items`, `team_chat_messages`, `players`, `team_members` | `team_id` + RLS via `is_team_member` / `is_team_coach`                                   |
| Korsreferenser                                                    | `content_links` (`source_type/source_id` → `target_type/target_id`)                                                                                                                                                                       | Fritt textpar, ingen främmande nyckel – gäller både bank- och användarinnehåll           |

Redan befintliga funktioner som **inte** ska byggas om som nya parallella funktioner:
passmallar (`coach_sessions.is_template`), favoriter (`tb_favorites`), periodplanering
(`team_periods`, `period_links`, `period_progression`), tidslinje i passvisningen och
passgenomförande (`session_runs`, `session_run_items`, `session_run_attendance`).

## 3. Rollmatris (avsedd behörighet)

| Roll                                                    | Källa                                      | Får                                                                               | Får inte                                     |
| ------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- | -------------------------------------------- |
| coach / head_coach / club_admin med `status = approved` | `team_members`                             | Planera, kalla, registrera närvaro, chatta, se privata spelaruppgifter i eget lag | Något i annat lag                            |
| player (godkänd)                                        | `team_members` + `players.member_user_id`  | Se lagets aktiviteter, svara på egna kallelser                                    | Administration, andras privata uppgifter     |
| Vårdnadshavare                                          | `player_guardians.is_active`               | Svara för kopplade barn, se barnets aktiviteter                                   | Ledaruppgifter i barnets lag                 |
| Dubbelroll (ledare i A, vårdnadshavare i B)             | Två medlemsrader                           | Ledaruppgifter i A, barnets svar i B                                              | Ledaruppgifter i B                           |
| Väntande medlem                                         | `status = pending`                         | Se att ansökan väntar                                                             | All lagdata                                  |
| Indragen behörighet                                     | Borttagen medlemsrad / `is_active = false` | Inget                                                                             | Notiser och läsning via gamla barnkopplingar |

Global roll i `user_roles` (`admin`) styr endast plattformsadministration och ger aldrig
lagbehörighet; lagbehörighet härleds alltid ur `team_members` via `isLeaderRole()` +
godkänd status.

## 4. Stegstatus

| Steg                                           | Status              | Nuläge, berörda filer och verifiering                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 00 Baslinje                                    | **Uppfyllt**        | Detta dokument. Tester/typkontroll/bygge/lint körda, migrationsläge avläst.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 01 Konton, medlemskap, lagåtkomst              | **Uppfyllt**        | `accountReady`, uppskjuten lagkodskontroll till efter inloggning, kolumnvis SELECT på `teams` som skyddar `join_code`/`coach_join_code`, vuxenkontroll före guardian-medlemskap, födelsedatumstrigger. Filer: `src/hooks/useAccount.tsx`, `src/lib/account-setup.ts`, `src/routes/auth.tsx`, `src/lib/team-roles.ts`, `src/lib/permissions.ts`. Kvar att verifiera: samtidig acceptans av två länkar till samma spelarkort, direkta API-anrop som väntande/indragen medlem, ogiltigt kalenderdatum (31 februari) på servern. |
| 02 Kallelser                                   | **Delvis uppfyllt** | Transaktionell `save_invitation_plan`, atomisk anspråkslogik i `operation_results` (nyckel bunden till användare/scope/event), notisdedupe med operations-ID, senaste aktiva kallelse väljs. Kvar: `send_invite_reminders` räknar barn med nåbar vårdnadshavare även som onåbart; separata mått för spelare vs mottagarkonton saknas; två barn hos samma vuxen är inte bevisat mot dedupe; rollback-prov i riktig transaktion saknas.                                                                                        |
| 03 Skyddat arbete och utkast                   | **Delvis uppfyllt** | `save_match_plan` och `save_tactic_frames` är atomiska; matchplanens förläsning skiljer obligatoriska och valfria data; närvaro sparar uttryckligt `finalDraft`. `openBlankTactic` i `src/lib/db.ts` städar nu endast utkast helt utan innehåll (inga figurer, ritningar, namn eller anteckningar) och kastar fel vid läsfel i stället för att radera. Kvar: versionskontroll vid samtidig redigering.                                                                                                                                                                                |
| 04 Roller, status, datum, fellägen             | **Delvis uppfyllt** | Idag-vyn, `PlanStatusBadge`, `StateViews`, ICS-sluttid och kalenderrubrik med hemma–borta är på plats. Allergi är nu trelägesvärde (`boolean | null`) och visas som "Ej ifyllt" när uppgiften saknas; missvisande pushreglage borttaget ur `NotificationSettingsCard`. Kvar: oregistrerad närvaro skiljs inte tydligt från 0 %.                                                                                                                                                                         |
| 05 Förhandsvisa övningar utan att tappa passet | **Uppfyllt**        | Gemensam målkontext i `src/lib/training-pick.ts` (`eventId`/`teamId`/`sessionId`) följer med från både kalenderaktivitet och sparat träningspass. `traningspass/$id` har "Hämta från Träningsbanken", banken visar vilket pass man plockar till med returväg, listan bär kontexten till övningsvyn och `PickDrillButton` lägger övningen i passet med dubblettfråga. Tester: `src/lib/training-pick.test.ts`. |
| 06 Passrader, ordning och tid                  | **Uppfyllt** | Passrader och planeringsrader sorteras nu på plats, skapandetid och id, så ordningen är stabil även när samma övning ligger med två gånger. Flytt upp/ner numrerar om hela listan i stället för att byta två platser. Tester: `src/lib/coach-sessions.test.ts`, `src/lib/planning-order.test.ts`. |
| 07 Instruktioner och taktikkort                | **Delvis uppfyllt** | 60 bildtexter i `tb_tactics` omarbetade; sex-mot-fem-undantaget bevarat. Regelkontroll mot aktuell SvFF-källa återstår.                                                                                                                                                                                                                                                                                                                                                                                                      |
| 08 Egen övning kopplad till taktikbild         | **Saknas**          | `coach_drills` har ingen koppling till `tactics`/`tb_tactics`; `content_links` används inte för detta.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 09 Filter med tillförlitlig metadata           | **Uppfyllt** | Metadata inventerad 2026-09-08: 112 artiklar utan tomma fält (kategori, sammanfattning, ålder, spelform, nivå, typ, lästid, evidens), 14 övningar med syfte och kopplad taktik, 20 taktikkort med fas/ålder/spelform, 8 målvaktskort med ålder. Åldersfilter tillagt för målvaktsövningar (`filterGoalkeeperCards`) med test. Färdiga träningspass saknar åldersdata och filtreras därför bara på sökning och favorit.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 10 Var övningen används och genomförts         | **Uppfyllt** | Övningssidan visar nu "Så har du använt övningen": rader ur `coach_session_items`, `event_resources` och `session_run_items` med datum, källa och om övningen är genomförd. Filer: `src/lib/drill-usage.ts`, `src/routes/_authenticated/ovningsbank.$drillId.tsx`. Tester: `src/lib/drill-usage.test.ts`. |
| 11 Namngivna övningssamlingar                  | **Uppfyllt**        | `tb_collections`/`tb_collection_items` med RLS, `src/lib/collections.ts` (+ test), `CollectionButton` på övningssidan och sidan `/ovningsbank/samlingar` för att skapa, byta namn, ta bort och rensa innehåll.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 12 Frånvaro över datumintervall                | **Saknas**          | `event_attendance` är per aktivitet; inget intervallstöd.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 13 Återanvända platser, konkret uppföljning    | **Saknas**          | `events.location` är fritext utan förslagslista.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 14 Slutverifiering                             | **Ej påbörjat**     | Kräver steg 01–13.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| E1 Valbar e-post för matchkallelser            | **Saknas**          | Endast notiser i appen; ingen e-postkanal.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

## 5. Tidigare fynd – gäller de fortfarande?

| Fynd                                         | Bedömning                                                                                |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Lagkodens registreringsanrop före inloggning | Åtgärdat – kontrollen sker efter autentisering                                           |
| Kodkolumner exponerade via bred SELECT       | Åtgärdat – kolumnvisa rättigheter; direkt API-prov som väntande/indragen medlem återstår |
| Vuxenkontroll före guardian-medlemskap       | Åtgärdat i `accept_team_invite`                                                          |
| Samtidiga kallelseoperationer                | Åtgärdat med atomiskt anspråk; två-barnsfallet ej bevisat                                |
| Påminnelsers nåbarhet                        | **Kvarstår**                                                                             |
| Förläsningsfel blir tom matchplan            | Åtgärdat                                                                                 |
| Ny taktiktavla rensar andra utkast           | Åtgärdat – endast tomma utkast städas                                                    |
| Saknad uppgift visas som noll eller nej      | Åtgärdat för allergi; närvaroprocent kvarstår                                            |
| Tappad målaktivitet i övningsbanken          | **Kvarstår** (steg 05)                                                                   |
| Lokala datum                                 | Delvis åtgärdat (ICS-sluttid); sommartid och midnatt ej provade                          |
| Missvisande pushtext                         | Åtgärdat – reglaget borttaget                                                            |
| Pedagogiska brister i taktikkort             | Åtgärdat för alla 60 bildtexter                                                          |

## 6. Ingång till steg 01

Konkreta prov som steg 01 ska genomföra: direkt REST-anrop mot `teams` som anonym,
väntande medlem, spelare, vårdnadshavare och ledare; två personliga länkar till samma
spelarkort samtidigt; registrering med 31 februari mot servern; kontobyte direkt efter
misslyckad profilhämtning.

## 7. Steg 01 – genomfört 2026-09-08

Genomförda ändringar:

- `accept_team_invite` gick inte att använda alls för någon som inte redan var
  godkänd medlem: namnkrocken mellan utdatakolumnen `team_id` och tabellkolumnen
  gav ett rått databasfel. Funktionen är omskriven med `#variable_conflict use_column`
  och rättigheterna satta till inloggade och service_role.
- Rättigheter som inte krävs har tagits bort: `anon` hade kvar INSERT/DELETE på lag
  och full skrivrätt på klubbar (RLS blockerade redan, men rättigheterna fanns kvar).
- Omöjliga födelsedatum (t.ex. 31 februari) stoppas nu i appen med begriplig text,
  både vid registrering och i Inställningar, i stället för att bli ett databasfel.
  Ny hjälpare `birthDateError` i `src/lib/account-setup.ts`.

Bevarade lösningar: `accountReady`, `isLeaderRole` + godkänt medlemskap, uppskjuten
kodkontroll efter inloggning, kolumnvisa rättigheter som skyddar `join_code`/`coach_join_code`,
vuxenkontroll före guardian-medlemskap, födelsedatumtriggern i databasen.

Ändrade filer: `src/lib/account-setup.ts`, `src/lib/account-setup.test.ts`,
`src/routes/_authenticated/installningar.tsx`. Migrationer: borttagna anon-rättigheter
på `teams`/`clubs`, omskriven `accept_team_invite`.

Databas- och behörighetsprov (isolerad QA-data, borttagen direkt efteråt):

| Prov                                              | Resultat                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| Anonymt REST-anrop mot `teams` (även `join_code`) | Nekad (42501)                                                       |
| Anonymt REST-försök att skapa lag                 | Nekad                                                               |
| Väntande medlem läser laget                       | Ser lagets namn, inga koder, 0 aktiviteter, 0 spelare, 0 chatt      |
| Väntande medlem läser `join_code`                 | Nekad (42501)                                                       |
| Två personliga länkar till samma spelarkort       | Första kopplas, andra avvisas med begriplig text; kortet oförändrat |
| 31 februari i registrering och profil             | Stoppas i appen med "Det datumet finns inte."                       |

Kodtest: 55 filer, 495 tester gröna. `tsgo --noEmit` utan fel. ESLint 0 fel, 17 kända varningar.

Inte verifierat: verkligt samtidigt anrop från två parallella databassessioner (provet
kördes sekventiellt med låsningen på plats), samt e-postbekräftelse på annan enhet.

## Steg 02 – Kallelser, mottagare och notiser (uppfyllt)

Fynd och rättningar:

- Mottagare av kallelser och påminnelser hämtades tidigare enbart från spelarkortets
  konto och aktiva vårdnadshavare, utan kontroll av lagmedlemskap. En vuxen som tagits
  bort ur laget kunde därför få nya notiser via en gammal barnkoppling. Ny intern
  funktion `invite_recipient_users(player_id, team_id)` kräver godkänt medlemskap i rätt
  lag och används nu av både `save_invitation_plan` och `send_invite_reminders`.
- Påminnelserapporten räknade ett barn med nåbar vuxen som "utan konto". Räkningen görs
  nu per kallelse och bara när ingen mottagare alls finns.
- Två samtidiga tryck på påminnelse kunde skicka dubbla notiser. Nu tas ett lås per
  aktivitet och notiserna har en dubblettnyckel per mottagare och timme.
- Påminnelser stoppas även när kallelsen är stängd, inte bara vid inställd eller påbörjad match.
- En vuxen med ett nykallat och ett tidigare kallat barn fick både "Ny kallelse" och
  "Kallelsen har ändrats" i samma handling. Ändringsnotisen hoppas nu över för den som
  redan fått en ny kallelse i samma sparning.
- Inställningen "Push på den här enheten" lovade utskick som inte finns; ingen
  push-avsändare är kopplad. Rutan visar nu var notiserna faktiskt syns.

Ändrade filer: `src/components/NotificationSettingsCard.tsx`.
Migrationer: ny `invite_recipient_users`, omskrivna `save_invitation_plan` och
`send_invite_reminders`, samt borttagen direktåtkomst till hjälpfunktionen.

Kodtest: 55 filer, 495 tester gröna. `tsgo --noEmit` utan fel. ESLint 0 fel, 17 kända varningar.
Säkerhetslintern ligger kvar på 45 kända varningar (oförändrat).

Inte verifierat: verkligt samtidigt påminnelsetryck från två parallella sessioner.
