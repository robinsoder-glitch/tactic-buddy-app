# Löpningar och passningar ska skapa rörelse mellan steg

## Problemet

I dag: när du väljer Löpning eller Passning och drar en spelare/boll så flyttas objektet direkt i det steg du står i, och pilen ritas där. När du sedan lägger till nästa steg kopieras positionerna rakt av — båda stegen ser likadana ut, och uppspelningen visar ingen förflyttning.

## Så ska det fungera

Att dra med Löpning eller Passning betyder "härifrån till dit, under nästa steg":

- Objektet blir kvar på sin **startposition** i det steg du står i.
- Pilen (löplinje eller passningslinje) ritas i det steget, så du ser vad som ska hända.
- **Slutpositionen** skrivs in i nästa steg. Står du på sista steget skapas nästa steg automatiskt.
- Objekt som inte flyttats står stilla — deras position följer med oförändrad.
- Under uppspelning glider spelaren/bollen mjukt från steg N till steg N+1 längs pilen, precis som pilen visar.

Verktyget **Flytta** fungerar som förut: det justerar positionen i det aktuella steget utan att skapa någon rörelse.

## Detaljer

- Efter en löpning/passning hoppar vyn till nästa steg så att du direkt ser resultatet och kan fortsätta bygga sekvensen; det går att stega tillbaka.
- Har du redan senare steg där objektet stod kvar på den gamla positionen uppdateras även de, så att kedjan hänger ihop i stället för att objektet studsar tillbaka.
- Hela åtgärden (pil + ny position + eventuellt nytt steg) blir **ett** ångra-steg.

## Teknisk genomgång

- `objectTrail` i `src/routes/_authenticated/tactic.$id.tsx` skrivs om: i stället för att bara lägga till en pil ska den återställa objektets position i aktuell frame till dragets startpunkt, lägga till pilen där, och sätta slutpositionen i nästa frame (skapas via samma logik som `addFrame` om den saknas), samt uppdatera efterföljande frames som fortfarande hade startpositionen.
- Allt sker i ett `commit`-anrop så att ångra/gör om och den beständiga historiken (`src/lib/tactic-history.ts`) behandlar det som en enhet.
- `moveObject` under pågående drag behålls för live-feedback; startpositionen sparas redan i `dragStart` i `src/components/Pitch.tsx` och skickas till `objectTrail`.
- Ingen ändring krävs i `interpolateFrames` (`src/lib/tactics.ts`), canvas-rendering eller export — de animerar redan skillnader mellan frames.
