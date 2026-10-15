# Endast läsande kvalitetskontroll av Fotbollsrummet

Inga projektfiler ändras, inget publiceras, inga konton skapas, ingen data sparas, inga kallelser, mejl eller meddelanden skickas.

## Miljö och version
- Förhandsvisningen (localhost:8080, samma kod som förhandsvisningen) med den redan inloggade testsessionen, om en sådan finns.
- Den publicerade sidan (fotbollsrummet.app) kontrolleras bara utan inloggning: startsida och inloggningssida.
- Versions-id: aktuell git-revision (läses med `git rev-parse HEAD`, ändrar inget) anges i rapporten tillsammans med miljön för varje resultat.

## Steg
1. Startsida – laddas, inga konsolfel, rubrik och knappar syns (förhandsvisning + publicerad).
2. Inloggningssida (e-post) – formuläret visas; inga uppgifter fylls i eller skickas.
3. Om sessionen är inloggad:
   - Planera – korten och månadskalendern visas.
   - Planera match – sidan laddas; datumfältet öppnas, ett datum klickas och visningen kontrolleras; ingenting sparas och dialogen stängs.
   - Planera träning – sidan laddas; "Koppla träningspass eller övning" öppnas, flikarna gås igenom, ett pass förhandsvisas, "Tillbaka" klickas. "Välj" klickas inte (skulle ändra utkastet).
4. Skärmdumpar, konsol- och nätverksfel samlas in.
5. Om sessionen saknas eller är utloggad markeras steg 3 som blockerat – ingen ny inloggning skapas.

## Rapport
- Exakt vilka sidor och steg som provades, per miljö.
- Fel som hittades (synliga, konsol, nätverk).
- Vad som var blockerat och varför.
- Inga rättningar föreslås som ändringar, bara iakttagelser.
