# Taktikbank 5 mot 5 i appen

Hela seed-filen läggs in i databasen och blir en läsbar taktikbank för tränare och admin, med möjlighet att koppla kort, övningar och färdiga pass till ett träningstillfälle.

## Vad tränaren får

- **Ny sida "Taktikbank"** (nås från startsidan och från lagets flikar). Filter på spelform (5 mot 5 / 7 mot 7), spelmoment, fas och svårighetsgrad, plus fritextsök.
- **Taktikkort** (20 st): titel, syfte, trigger, barnfras, coachfråga, beslutsregel, rollhandlingar, vanligt fel, rättelse och framgångstecken. Källa och källtyp visas tydligt så att officiell regel inte blandas ihop med redaktionellt innehåll.
- **Uppspelning**: kortets tre steg (start, rörelse, beslut) animeras på befintlig plan med spelare, boll, löp- och passpilar samt bildtext per steg. Spela/pausa, steg fram/bak och spegelvändning. Läsläge – inget sparas tillbaka till kortet.
- **Målvaktsbank** (8 kort): syfte, trigger, barnfraser, steg och vanliga fel.
- **Övningar** (14 st) och **färdiga träningspass** (3 st) med blocklista, minuter och fokus.
- **Formationer** (7 st) visas som uppställning på planen och kopplas till korten.
- **Regelprofiler** (5v5 och 7v7) och **distriktsprofiler** som en faktasida: planmått, speltid, retreatlinje, fasta situationer, med länk till källan.

## Koppling till träning

- När en tränare skapar eller redigerar en träning går det att koppla ett eller flera taktikkort, övningar eller ett helt pass.
- Träningsvyn och kalendern visar de kopplade posterna. Ett kopplat pass fyller automatiskt in blocken som en punktlista i träningen.
- Spelarna ser inte taktikbanken. Kopplat innehåll syns bara för tränare/admin i detta steg (kan öppnas för spelare senare).

## Åtkomst

Endast tränare och admin kan öppna taktikbanken. Innehållet är gemensamt för alla (global bank) och kan bara ändras av systemet, inte av användare.

## Teknisk plan

Migration (nya publika tabeller, alla med GRANT + RLS där läsning kräver rollen coach eller admin, skrivning endast service_role):

- `tb_rulesets`, `tb_district_profiles`, `tb_formations`, `tb_taxonomy` (nycklar/etiketter)
- `tb_tactics` (id, titel, format, ålder, svårighet, spelmoment, fas, syfte, formation, coachtexter, `actors` jsonb, `keyframes` jsonb, `image_script` jsonb, `sources` jsonb)
- `tb_goalkeeper_cards`, `tb_drills`, `tb_training_sessions` (block som jsonb)
- `event_resources` (team-ägd länktabell: event_id, typ `tactic`/`drill`/`session`, resource_id) med policy: lagets tränare hanterar, lagmedlemmar läser.

Datainläsning: seed-filens innehåll skrivs in med run_sql efter migrationen (INSERT per tabell, idempotent via `on conflict (id) do update`).

Frontend:

- `src/lib/taktikbank.ts` – typer, hämtning och en konverterare som mappar kortets kumulativa keyframes (0–10000, x=eget mål) till appens `Frame[]`/`FieldObject`/`Drawing` (x/10000, y/10000), inklusive boll, pilar (`run`/`pass`) och bildtext som `note`. Spegelvändning = `1 - x`.
- `src/routes/_authenticated/taktikbank.tsx` – lista med filter; `taktikbank.$cardId.tsx` – kortvy med `Pitch` i uppspelningsläge (återanvänder befintlig interpolering och tidslinje).
- Flikar i banken: Taktikkort, Målvakt, Övningar, Pass, Regler.
- `EventManager` utökas med en "Koppla innehåll"-väljare som skriver till `event_resources`; träningsvyn listar kopplat innehåll med länk till kortet.
- Rollskydd: sidorna kontrollerar `isCoach || isAdmin` via `useAccount` och visar annars ett meddelande.

Allt UI på svenska i befintligt mörkt tema.
