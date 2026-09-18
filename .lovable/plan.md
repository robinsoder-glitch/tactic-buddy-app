# Åtgärder efter extremtest omgång 4

Rapporten (17 sep, rev 08d0d93) har sju åtgärdspunkter. Jag har kontrollerat varje punkt mot koden: sex är fortfarande aktuella, en är delvis redan hanterad. Inga nya produktfunktioner, ingen omdesign – bara rättningar.

## Vad som är aktuellt (verifierat mot koden)

1. **Profilen ändras trots misslyckad anslutning (P1)** – Bekräftat i `inbjudan.$token.tsx`: barnets namn och kontotyp skrivs till profilen *innan* anslutningen. Misslyckas anslutningen lämnas profilen ändrad. Rättning: flytta profilskrivning + anslutning till en atomär serverfunktion (RPC) som gör båda eller ingen.

2. **Skapa spelare + godkänn kan ge dubbla spelare (P1)** – Bekräftat i `kom-igang.tsx`/`teams.ts`: `saveTeamPlayer` och `approveTeamJoinRequest` är två separata anrop; misslyckas steg två skapar nästa försök en ny spelare. Rättning: ny atomär RPC som skapar spelaren, kopplar och godkänner i en transaktion, idempotent per ansökan.

3. **Läsfel tolkas som "inte medlem" (P2)** – Bekräftat: medlemskapsfrågan läser bara `data`, inte `error`. Rättning: kasta felet så sidan visar återförsöksvy i stället för ett nytt anslutningsformulär.

4. **Misslyckad mottagaruppslagning räknas som "skipped" (P2)** – Bekräftat i `invitation-email.functions.ts`: fel vid hämtning av vårdnadshavare och e-post ignoreras → `sent:0, skipped:1, failed:0`. Rättning: räkna uppslagningsfel som failed med tydligt besked.

5. **"Planerad" betyder olika i klient och databas (P2)** – Bekräftat: klienten (`plan-status.ts`) kräver bara sparad plan + en övning; SQL kräver dessutom fokusområde och mål. Rättning: en gemensam definition – klienten läser databasens `planning_done` (samma källa i alla vyer), ofullständig sparad plan får egen tydlig status.

6. **Dold textruta blir kvar vid misslyckad kopiering (P3)** – Bekräftat i `copy-text.ts`: städningen saknas i `finally`. Rättning: städa alltid, returnera aldrig true vid misslyckande.

## Delvis hanterad / mindre

7. **Saknad spelarväg för befintliga konton + vilseledande texter** – Bekräftat: på en gemensam länk till ett äldre lag (13+) får en inloggad spelare bara formuläret "Barnets namn" – anslutningen blir alltid vårdnadshavare. Rättning: låt inloggad användare välja "Jag är spelaren" / "Jag är vårdnadshavare" i lag där spelarkonton är tillåtna. Dessutom: toasten "Godkänd och kopplad" får inte visas när ledaren valt "Koppla senare", och en väntande tränare får inte etiketteras "Spelare" i Kom igång.

## Utanför planen

- **Punkt 8 (27 äldre regressioner):** Rapporten säger själv att dessa inte får stängas utan nya reproducerbara prov. Jag föreslår att vi tar dem som en egen genomgång efteråt, punkt för punkt – flera kan redan vara åtgärdade i senare revisioner.
- **Punkt 9 (slutkvittens):** Efter rättningarna kör jag ordinarie testsvit + Playwright-test av hela kedjan (registrering → ansökan → godkännande → kallelse → svar) med testkonton som raderas efteråt.

## Teknisk genomförande

- Ny migration: `join_team_with_profile(code, child_name)` (atomär, behörighetskontrollerad, idempotent) och `approve_join_with_new_player(member_id, player_name)` (transaktion + behörighetskoll per lag).
- Klientändringar: `inbjudan.$token.tsx` (join + medlemskapsfel + spelarval), `kom-igang.tsx` (anropa ny RPC, rätta toast/etikett), `invitation-email.functions.ts` (felräkning), `copy-text.ts` (finally), `plan-status.ts` + berörda vyer (gemensam statuskälla).
- Tester: vitest för nya RPC-gränssnitt och statuslogik; Playwright-kedja med testkonton för inbjudan → godkännande → kallelse → svar; testdata raderas efteråt.

## Acceptans

- Misslyckad anslutning lämnar profilen orörd; förnyat försök ger exakt en ansökan.
- Dubbelklick/två samtidiga ledare ger högst en spelarpost och en koppling.
- Läsfel visar återförsök, aldrig ett nytt formulär.
- Mejluppslagningsfel syns som failed, inte skipped.
- Samma "Planerad"-betydelse i lista, detaljvy och databas.
- Hela kedjan grön i Playwright; ordinarie testsvit passerar.
