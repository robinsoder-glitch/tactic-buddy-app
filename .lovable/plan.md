# Fullständig granskning och kvalitetssäkring av Fotbollsrummet

Arbetet görs i etapper. Efter varje etapp körs tester, typkontroll, lint och build, och jag rapporterar resultatet innan nästa etapp.

## Vad jag har bekräftat i koden hittills

- **A. Auth-läget i URL:en** — `src/routes/auth.tsx` håller läget i lokal state (`useState`) och växlar med `setMode`, medan `mode=signup` ligger kvar i URL:en. En omladdning återgår därför till registrering. Bekräftat.
- **B. Fel antal startspelare** — `planera-match.tsx` läser in sparad uppställning rakt av vid laddning (`setSlots(lineup.slots)`) utan att köra befintliga `syncLineupWithSquad`. Räknaren `starters.length/required` kan därför räkna spelare som inte längre finns i truppen. Bekräftat.
- **F. Ålderstaggar** — `src/lib/knowledge.ts` innehåller `age_label`, `age_5_7/8_9/10`, ett åldersfilter och en etiketthjälpare som används i gränssnittet. Bekräftat.
- **G. Lagdubbletter** — `fetchMyMemberships()` returnerar en rad per medlemskap utan att slå ihop per lag, så ett lag med två roller ger två kort. Bekräftat.
- **C och D** — inte bekräftade ännu. Laddningslägen i kalender/närvaro och förvalet i träningspasseditorn undersöks som första steg i sina respektive etapper innan något ändras.

## Etapp 1 – Kartläggning och baslinje

Inventera samtliga routes, komponenter, serverfunktioner, migrationer och RLS-regler. Köra tester, typkontroll, lint och build som baslinje. Klicka igenom den publicerade appen och notera konsol- och nätverksfel. Resultatet blir en fellista som styr etapp 2–7.

## Etapp 2 – Konton, roller och koder

- Testa hela kedjan: tränarkonto, lagskapande, tränarkod, spelarkod, extra tränare, spelare, vårdnadshavare kopplad till rätt spelare.
- Kontrollera att namn (inte e-post) visas efter registrering.
- Kontrollera felmeddelanden för ogiltig, gammal eller förbrukad kod.
- Verifiera behörigheter mot databasen: en användare får inte läsa eller ändra ett annat lags data.
- Enhetlig terminologi: **Tränarkod** och **Spelarkod**, aldrig "lagkod". Vid varje kodfält en kort hjälptext: vilken kod, vem ger den, vad som händer efter godkännande, vad man gör om den inte fungerar.

## Etapp 3 – Bekräftade fel A, B, G

- **A**: läget speglas i URL:en via routerns sökparametrar. Växling till inloggning tar bort `mode=signup`, bakåt/framåt fungerar, omladdning behåller valt läge.
- **B**: kör `syncLineupWithSquad` direkt vid inläsning och vid varje truppändring. Borttagna spelare räknas inte, siffran stämmer efter omladdning och efter spara–öppna–ändra–spara.
- **G**: slå ihop medlemskap per lag i `fetchMyMemberships`. Ett lagkort, roller som separata märken, växling och administration bevaras.

## Etapp 4 – Laddningslägen och träningspasseditorn (C, D)

- Undersök var kalender och närvaro beräknar status innan alla anrop är klara. Håll ett tydligt laddningsläge tills underlaget är komplett, så att status inte hoppar från fel till rätt. Hantera långsam anslutning, tomt svar och fel.
- Undersök om aktivitetsväljaren i träningspasseditorn har ett förval. Om så är fallet: tomt startvärde med platshållaren "Välj aktivitet", krav på aktivt val och ett begripligt valideringsmeddelande.

## Etapp 5 – Språk och Kunskapsbanken (E, F)

- Samla återkommande termer i en gemensam språkfil och använd dem konsekvent: tränarkod/spelarkod, träning/träningspass, tränare, spelare, planerad/påbörjad/klar/ej klar. Ta bort engelska rester som "training – träning" på startsidan.
- Ta bort ålderstaggar och åldersfilter ur Kunskapsbankens gränssnitt. Behåll kolumnerna i databasen (bakåtkompatibelt) men visa dem inte. Struktur blir kategori plus nivå (Grund, Fortsättning, Fördjupning). Kontrollera att filtrering, sortering, artikeldetalj, sammanfattning och källänk fungerar.

## Etapp 6 – Funktionstest av hela appen

Systematisk genomgång enligt din lista: startsida och navigation, direktlänkar och omladdning per route, bakåtvägar, 404 och behörighet, kalender, planera träning, planera match, trupp och närvaro, taktiktavlan (inklusive ditt scenario med fyra spelare, boll, sekvenser och uppspelning), Träningsbank och Kunskapsbank, samt övriga sidor: statistik, tränarsnack, mina lag, inställningar, periodplanering, bilder, profil och notiser. Även funktioner som finns i koden utan menylänk. Testas på desktop och i mobilbredd (320/375/430/1440 px).

## Etapp 7 – Teknisk kvalitet, tester och verifiering

- Åtgärda typfel, konsol- och nätverksfel, ohanterade promises, dubbla anrop, race conditions, saknad validering, saknade tomma/fel/laddningslägen, död kod och trasiga länkar.
- Granska RLS-reglerna för korsläckage mellan lag.
- Nya och uppdaterade tester: auth-URL-synk, registrering och koder, roll- och lagbehörigheter, trupp/uppställningssynk, kalenderstatus och laddningslägen, spara och öppna taktik, sekvensuppspelning, Kunskapsbankens nivåer utan ålderstaggar. Både lyckade flöden och felaktiga indata.
- Slutkontroll: build, typkontroll, hela testsviten, och verifiering i den publicerade appen efter driftsättning.

## Slutrapport

Branch och commit, verifierade fel, ändrade filer, grundorsak per fel, exakt åtgärd, tillagda tester, resultat från build/typkontroll/tester, vad som verifierats i den publicerade appen, kvarstående problem och eventuella steg du själv behöver göra. Inget markeras som löst utan verifiering.

## Avgränsningar

Ingen befintlig användardata raderas. Databasändringar görs bakåtkompatibla (inga borttagna kolumner). Fungerande funktionalitet ändras inte i onödan.
