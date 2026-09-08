# Snygg logga i både mörkt och ljust läge

## Vad som är fel idag

Det finns bara **en** loggbild: en helt vit variant. För ljust läge färgvänds den med ett filter i stilmallen (`.light .brand-logo { filter: invert(1) brightness(0.2) }`). Det gör att loggan aldrig visas i varumärkets riktiga färger – i mörkt läge blir den platt vit/gråvit mot den mörkgröna bakgrunden, och i ljust läge blir den en filtrerad gråsvart klump i stället för mörkgrön.

## Vad jag gör

1. **Två riktiga loggfiler i varumärkets färger**
   - Mörkt läge: hörnflagga och boll i den ljusgröna accentfärgen (#c7f464), texten "Fotbollsrummet" i varm off-white.
   - Ljust läge: samma logga men i djupgrönt (#0b2a1e) med boll/flagga i mörkare grön accent.
   - Båda med genomskinlig bakgrund, samma proportioner som idag, plus en variant med enbart märket (bollen och hörnflaggan) för menyn.

2. **Loggan väljer själv rätt variant**
   Komponenten som visar loggan känner av om appen står i ljust eller mörkt läge och visar rätt bild. Byter man läge i inställningarna byts loggan direkt, utan att sidan laddas om.

3. **Färgfiltret tas bort**
   Filtret i stilmallen försvinner, så inget färgvänds längre. Loggan visas exakt som filen ser ut.

4. **Kontroll på alla ställen loggan syns**
   Startsidan, inloggningen och menyn högst upp – i både ljust och mörkt läge, på mobil och dator.

## Innan jag bygger

Jag visar de två nya loggförslagen för dig innan de används skarpt, så att du får godkänna färgerna. Om du hellre vill återanvända en logga du redan har (t.ex. en färgversion i en fil) kan du ladda upp den, så använder jag den i stället för att rita en ny.

## Tekniska detaljer

- Nya bilder under `src/assets/` (logga + märke, mörk och ljus variant).
- `src/components/BrandLogo.tsx` läser aktuellt tema (samma källa som `src/lib/theme.ts` använder, `light`-klassen på `<html>`) och väljer bildkälla; lyssnar på temabyte.
- `.light .brand-logo`-regeln i `src/styles.css` tas bort.
- Ingen ändring i databas, behörigheter eller övrig funktion.
