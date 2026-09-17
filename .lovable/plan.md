# Test av hela inbjudningsflödet

Ett automatiserat genomklick av flödet från nytt lag till godkänd vårdnadshavare, körs mot appen i utvecklingsläget med två inloggade konton (en tränare och en familj).

## Så testas det

1. **Skapa lag** – logga in som tränare utan lag, fyll i klubb, lagnamn, åldersgrupp (P2016 så att laget räknas som yngre lag) och spelform, och skapa laget.
2. **Guidad start** – kontrollera att tränaren landar på starten i tre steg, lägger in ett barn i truppen och ser lagets inbjudningslänk.
3. **Dela länken** – hämta länken och öppna den i ett fristående fönster utan inloggning.
4. **Familjen går med** – skapa ett nytt familjekonto via länken, ange eget namn och barnets namn, och skicka ansökan.
5. **Godkänn** – tillbaka som tränare: godkänn ansökan och koppla vårdnadshavaren till barnets kort.
6. **Röd varning** – kontrollera på spelarkortet att den röda varningen "Ingen vårdnadshavare är kopplad – barnet får inga kallelser" syns innan kopplingen, och försvinner efter den. Kontrollera också att inget om spelarkonton nämns i det yngre laget.
7. **Kallelse** – skapa en aktivitet och bekräfta att den kopplade vårdnadshavaren ser kallelsen och kan svara.

## Om något inte fungerar

Fel som hittas rättas i samma omgång, med ett kort besked om vad som var trasigt och vad som ändrades. Skärmbilder från varje steg sparas som bevis.

## Tekniskt

- Playwright-skript under `/tmp/browser/invite-flow/`, mot `http://localhost:8080`, viewport 1280x1800.
- Sessioner skapas med `lovable auth-session --json` för tränaren; familjekontot registreras genom inbjudningslänken.
- Efter testet körs `bunx vitest run`, `bunx tsgo --noEmit` och ESLint.
