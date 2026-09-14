# Live-test, extremtest och kvittens i matchimporten

## Utgångsläge

Taktiktavlan har redan både uppspelning (steg för steg med hastighet) och export till
PDF, GIF och video, inklusive förhandsgranskning av PDF:en med val av pappersstorlek,
orientering, marginal, skalning och omslagssida. Punkt 3 blir därför en kontroll av att
detta fungerar live, inte ett nybygge. Hittar testet luckor rättas de.

Matchimporten visar idag bara ett samlat kvitto ("X matcher lades till"). Den saknar
per-rad-besked, vilket är den enda kodändringen som är säkert nödvändig.

## 1. Live-test av inloggning och direktlänkar

På den publicerade sajten:

- Inloggning med lösenord, registrering av nytt konto och Google-inloggning.
- Skyddade direktlänkar (`/kalender`, `/planera`, `/teams`, ett lag, en aktivitet):
  utloggad → landar på inloggningen → efter inloggning tillbaka till samma sida.
- Samma kontroll för Google-vägen och för e-postbekräftelsen efter registrering.

Konton som skapas i testet tas bort efteråt.

## 2. Fullständigt extremtest

- **Taktiktavlan:** flytta en spelare, låt sparningen börja, flytta igen innan svaret
  kommit, ladda om och kontrollera att den sista flytten finns kvar. Samma sak vid byte
  av plantyp och formation.
- **Träningspass:** ändra titel/mål/anteckning, hämta övning från banken, avsluta ett
  pass — med nätverket avstängt mitt i sparningen. Kontrollera att inget hamnar
  halvsparat och att felet syns tydligt.
- **Matchimport:** starta sparning av flera matcher på långsam anslutning och försök
  ändra en rad under tiden; kontrollera att sparade rader försvinner ur listan och att
  osparade ligger kvar.
- **Uppspelning och export:** spela upp en taktik, exportera PDF (A4 + A3, stående och
  liggande, med och utan omslag) och kontrollera att alla steg finns i filen.

## 3. Kvittens per match i importen

I importdialogen får varje rad en egen status medan och efter sparningen:

- väntar, sparas nu, sparad (bock), eller misslyckad med orsaken skriven i klartext
  under raden.
- Sparningen stannar inte längre vid första felet — varje vald rad försöks, och de som
  lyckades markeras sparade. Redan sparade rader kan inte sparas igen.
- Sammanfattningen överst säger hur många som sparades och hur många som misslyckades,
  med en knapp "Försök igen med de som misslyckades".

## Teknisk not

- Live-testet körs med Playwright mot den publicerade adressen; inloggad session mintas
  med `lovable auth-session`.
- `MatchImportDialog.tsx`: radstatus i en `Map<number, "pending" | "saving" | "saved" |
  { error: string }>`; `create()` byter `break` mot att samla fel per rad; befintlig
  låsning av fält under sparning och dubblettkontrollen behålls.
- Inga nya sidor, huvudmenyval eller notiskanaler. Inga ändringar av innehåll eller
  användardata utöver borttagning av egen testdata.
