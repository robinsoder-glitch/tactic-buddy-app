# Importera matcher från PDF eller länk

Ja, det går. I Planera match lägger vi till "Importera matcher", där du antingen laddar upp ett spelschema som PDF (eller bild) eller klistrar in en länk till sidan där lagets matcher står. Texten läses av en AI-modell som plockar ut datum, tid, hemmalag, bortalag och plats.

## Så fungerar det för dig

1. Du väljer lag och trycker på "Importera matcher".
2. Du laddar upp en PDF/bild eller klistrar in en webbadress.
3. Du får en lista med de matcher som hittades, redan ifyllda med datum, tid, motståndare och plats.
4. Du kan rätta fel, kryssa bort matcher du inte vill ha, och sedan trycka "Skapa matcher".
5. Matcherna läggs in i kalendern precis som när du bokar en match manuellt. Kallelser skickas inte automatiskt — det gör du som vanligt efteråt.

Inget skapas utan att du godkänt listan, så en feltolkad rad kan aldrig fylla kalendern med skräp.

## Viktiga begränsningar

- Länkar fungerar bara för sidor som är öppna utan inloggning. Sidor som kräver konto (vissa förbundssidor) måste laddas upp som PDF i stället.
- Skannade/fotograferade scheman fungerar, men blir mindre exakta än en riktig PDF.
- Vi hoppar över matcher som redan finns i kalendern på samma dag och tid, så en ny import inte skapar dubbletter.
- Årtal saknas ibland i scheman; då antas innevarande säsong och raden markeras som "kontrollera".

## Tekniskt

- Ny serverfunktion `src/lib/match-import.functions.ts`:
  - `parseMatchSource` tar antingen uppladdad fil (base64, PDF/bild) eller en URL.
  - PDF-text extraheras i handlern; hämtade sidor rensas till text före AI-anropet.
  - Anropar Lovable AI Gateway (`google/gemini-2.5-flash`) med strukturerat svar (tool/JSON-schema) som ger `{ date, time, home_team, away_team, location, confidence }[]`.
  - Validerar svaret med Zod, normaliserar datum/tid till lokal tid och returnerar aldrig fritext direkt till kalendern.
  - URL-hämtning begränsas till http/https, publika värdar, max svarstorlek och timeout.
- Ny modul `src/lib/match-import.ts` (ren logik, enhetstestad): normalisering av datum/tid, hem/borta-tolkning utifrån lagnamnet, dubblettfilter mot befintliga events, samt sortering.
- Ny komponent `src/components/match/MatchImportDialog.tsx`: källval, laddningsläge, redigerbar tabell över hittade matcher, kryssrutor och "Skapa matcher".
- Skapandet återanvänder samma insert-väg som `EventManager` använder för `type: "match"` (`starts_at`, `ends_at`, `home_team`, `away_team`, `location`), så behörigheter och RLS är oförändrade.
- Knappen läggs i `src/routes/_authenticated/planera-match.tsx` bredvid befintlig "Nytt"/"Boka match", endast för tränarroller.
- Tester: `src/lib/match-import.test.ts` för datumtolkning, hem/borta, dubbletter och trasiga AI-svar.
