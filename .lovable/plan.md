# Hela träningen på ett ställe

Målet: en tränare bygger en färdig träning och kopplar den till en träning i kalendern, så att andra tränare i laget kan öppna och genomföra den även om den som planerat inte är på plats.

## Namn och struktur

- "Mina träningspass" heter "Mina träningar" (rubrik, meny, knappar, sidtitlar).
- "Övningsbank" heter "Träningsbank" överallt i gränssnittet (menyn, rubriker, länktexter, sidtitlar). Adressen `/ovningsbank` behålls så gamla länkar fungerar; bara texten byts.
- Ett planerat pass kallas konsekvent "träning" i texterna, aktiviteten i kalendern kallas "aktivitet i kalendern" när de behöver särskiljas.

## Skapa en träning – tre tydliga vägar

När man trycker "Skapa träning" visas ett val med tre kort:

1. **Använd ett färdigt pass** – väljs ur träningsbankens färdiga träningspass, kopieras till mina träningar och kan sedan ändras fritt.
2. **Utgå från en av mina tidigare träningar** – kopierar en egen träning (finns redan som Duplicera, men blir nu en av startvägarna).
3. **Börja från tomt** – dagens formulär med titel, datum, ålder, spelform, tema, mål och anteckningar.

Efter valet landar man alltid i samma redigeringsvy, så det bara finns ett sätt att bygga innehållet.

## Koppling till kalendern

- I redigeringsvyn (och i listan) finns "Koppla till träning i kalendern": man väljer bland kommande träningar i de lag där man är tränare.
- Kopplingen sparas som en resurs på aktiviteten, precis som övrigt bankinnehåll, så att den syns på aktivitetens sida.
- På aktivitetens sida visas den kopplade träningen med rätt titel, total tid och antal delar, plus en knapp "Öppna genomförandeläge". Idag visas bara ett id för personliga pass – det rättas.
- Alla godkända tränare i laget kan öppna och genomföra en kopplad träning. Endast den som skapat den (eller en admin) kan ändra i den; andra tränare kan ta en egen kopia.
- I "Mina träningar" visas för varje träning om den är kopplad, till vilket lag och vilket datum – annars "Inte kopplad ännu".

## Förenklingar så det inte blir rörigt

- Två snarlika knappar finns idag i banken: "Lägg till i pass" och "Lägg till i träning i kalendern". De slås ihop till en knapp "Lägg till i träning" där man i samma dialog väljer mål: en av mina träningar eller en aktivitet i kalendern, plus antal minuter.
- Kortknapparna i banken städas till högst tre: Öppna, Lägg till i träning, Favorit.
- Redigeringsvyn får en tydlig summering överst: total tid, antal delar och kopplingsstatus.
- Statusen "Utkast/Genomförd" behålls men visas bara som en liten etikett, inte som eget val i skapandeflödet.

## Teknisk sammanfattning

- Databas: `coach_sessions` behöver en migrering med `team_id` (nullable) och läspolicy så att godkända tränare i laget kan läsa träningen och dess delar; ändringsrätt kvar hos ägaren och admin. Kopplingen till kalendern lagras i `event_resources` med `kind = 'session'` och `resource_id` = träningens id.
- `src/lib/event-planning.ts` utökas med att koppla/koppla loss en egen träning och att läsa lagets kopplade träningar.
- `src/components/EventResources.tsx` slår upp titlar även från `coach_sessions`, inte bara bankens `tb_training_sessions`.
- `AddToSessionDialog` och `AddToTrainingDialog` ersätts av en gemensam dialog.
- Textbyten görs i `AppNav.tsx`, `src/routes/index.tsx`, `traningspass.*`, `ovningsbank.*`, `taktikbank.index.tsx`, `DrillDetails.tsx`, `RelatedContent.tsx` samt berörda `head()`-titlar; etikettester i `src/lib/labels.test.ts` och `banks.test.ts` uppdateras.
- Nya enhetstester för kopplingslogiken och behörighet (vem får se/ändra en kopplad träning).
