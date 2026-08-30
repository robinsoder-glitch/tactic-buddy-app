# Startsida + delning och export

## Vad som redan finns

Efter genomgång av koden finns tre av de fyra önskemålen redan på plats:

- Ångra/Gör om finns i taktikeditorn (knappar + Ctrl+Z / Shift+Ctrl+Z) och täcker spelarflytt, steg, zoner och markeringar.
- Tidslinje/scrubber finns: reglaget under planen hoppar till valfri tidpunkt, pausar där och spelar vidare därifrån.
- Delningslänk finns: varje taktik får en publik länk (/t/…) som andra kan öppna utan konto.

Det som saknas är exportval och fil-export. Plus startsidan du markerade.

## 1. Bättre startsida (huvudfokus)

Dagens sida är en rad staplade knappar och en platt lista. Föreslagen ombyggnad:

- **Hero-rad**: hälsning med ditt namn, dagens datum och nästa träning/match från kalendern, med snabblänk dit.
- **Snabbstart-kort** (2x2-rutnät med ikoner istället för knappraden): Ny taktik, Taktikbank, Spelarbank, Mitt lag.
- **Fortsätt där du var**: senast öppnade taktiken högst upp med miniatyrbild.
- **Taktikkort med förhandsvisning**: varje taktik visas som kort med en liten renderad planbild (första steget), namn, plantyp, antal steg och datum. Åtgärder (byt namn, duplicera, dela, ta bort, exportera) flyttas in i en meny-knapp så korten blir rena.
- **Sök och sortering**: sökfält samt sortering på senast ändrad / namn, plus filter på lag när du är tränare i flera lag.
- **Namnbyte i dialog** istället för webbläsarens prompt.
- **Tomt läge** med tydlig uppmaning och genväg till mallarna i taktikbanken.
- Mobilanpassat rutnät (ett kort per rad på mobil, två på surfplatta/desktop) i befintligt mörkt tema.

## 2. Spara/öppna som fil

- "Exportera fil" laddar ner taktiken som `.taktik.json` (steg, objekt, linjer, zoner, noteringar).
- "Importera fil" på startsidan skapar en ny taktik av en sådan fil, med validering och tydligt felmeddelande vid fel format.
- Kopiera-delningslänk får en egen knapp direkt på taktikkortet.

## 3. Exportval för GIF/MP4

Ny exportdialog i editorn med:

- Format: GIF eller MP4/WebM.
- Bildhastighet: 10 / 15 / 24 / 30 fps.
- Kvalitet/upplösning: Låg (480 px), Mellan (720 px), Hög (1080 px) — styr även bithastighet för video och färgpalett för GIF.
- Hastighet per steg återanvänds från uppspelningens hastighetsreglage.
- Uppskattad filstorlek/längd visas, och valen sparas som standard till nästa gång.

## Teknisk sammanfattning

- `src/routes/index.tsx` byggs om: nya delkomponenter för hero, snabbstart, sök/sortering och taktikkort.
- Miniatyrbild renderas med befintlig `drawScene` i `src/lib/render-canvas.ts` via en liten `TacticThumb`-komponent (canvas, första steget).
- `src/lib/export-clip.ts`: `ExportOptions` utökas med `quality` och bithastighet; GIF-paletten anpassas efter kvalitet.
- Ny `src/components/ExportDialog.tsx` samt import/export av JSON i `src/lib/tactic-file.ts`, kopplat till `createTacticFromFrames` i `src/lib/db.ts`.
- Inga databasändringar krävs.
