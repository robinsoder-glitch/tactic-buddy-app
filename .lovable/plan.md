# Genomgång av "Samlad analys och testhistorik" (8 sep 2026)

Dokumentet är ett historiskt kontrollregister (FR01–FR58) plus konkreta restpunkter (K01–K10, V01, O01–O04, R01–R06). Nedan: vad som redan finns i appen idag, vad som återstår, motstridigheter och förslag.

## Redan infört (kontrollerat i dagens kod/databas)

- Kallelser sparas i en enda serverhandling med operations-id och kvittens (dubbelsparning ger inte dubbla kallelser). R06/FR13.
- Nytillagda mottagare får inte både "ny kallelse" och "ändrad kallelse". R05/FR17.
- Matchens uppgifter och matchplan sparas tillsammans. R02/FR25.
- Vuxenkontroll vid barnkoppling, inbjudan och återaktivering; en redan godkänd vuxen kan kopplas till fler barn. R01/R03/R04, FR06/FR08.
- Läsfel visas som tekniskt fel med "Försök igen" i stället för tom lista (kallelser, tränarvyn, barnlistor). K02/K05/K06/FR20.
- Allergi/hemlig information maskeras inte längre till "nej" vid läsfel. K01.
- Svarsknappar döljs på återkallade kallelser och konkret sista svarsdag visas. K03/K04.
- Lagmenyn är rollanpassad; ledarrättigheter gäller tränare, huvudtränare och klubbadmin. K07/FR10/FR51.
- Födelsedatum valideras (saknat/ogiltigt stoppas). K08/K09.
- Pågående aktivitet räknas inte som genomförd. K10.
- Namn på reglage och listor i Inställningar; stängknappen heter "Stäng". V01/O04.
- Kunskapsbanken innehåller 112 publicerade artiklar; taktiksparande, tränarsnack (300 senaste) och ICS-tider är åtgärdade tidigare.

## Återstår – konkreta småfel

1. Aktivitetssidan väljer fortfarande första kallelseraden (`list[0]`) för text och svarsdag. Med en återkallad rad kan gammal text visas. FR15.
2. Närvaro: "Färdigställ" sätter status och sparar via en fördröjning i stället för att skicka det färdiga underlaget direkt till sparningen. Fungerar oftast, men är den kvarstående risken i FR30.

## Återstår – större, ej slutverifierade områden

3. Hela mottagarkedjan live: separata spelar- och vårdnadshavarkonton som tar emot, svarar, blir återkallade och kallade igen. FR13–FR21.
4. Samtidighetsprov i databasen: två personer som svarar/accepterar samma inbjudan samtidigt, dubbla flikar vid taktiksparning. FR09/FR40.
5. Innehållsrättningarna för de 20 färdiga taktikkorten (kapitel 7) är inte införda – det är fortfarande förslag.
6. Delade matchlänkar (utgånget datum, kopieringsbesked), media/lagring, offline/PWA och kontoåtgärder är inte slutverifierade. FR33/FR53/FR54/FR55.
7. Tillgänglighet i övrigt (tangentbord, fokus, skärmläsare) är bara delvis kontrollerad. FR52.

## Motstridigheter i underlaget

- **Artikelfilen med 112 poster mot tidigare redaktionella beslut.** Dokumentet varnar för att importera 112-filen rakt av: KB043 skulle vara avpublicerad i väntan på poddgranskning, KB002 flyttad till "Fortsättning" och åldrar dolda i vyn. Idag är alla 112 publicerade och alla har åldersuppgift lagrad. Behöver ett beslut: gäller 112-filen eller de äldre rättningarna?
- **"Klar" på matchplan.** Äldre krav: full trupp. Senare: bekräftat undantag för få spelare. Dokumentet säger uttryckligen att inget ovillkorligt femspelarkrav ska införas – bara tydligare förklaring av vad "Klar" betyder.
- **Startsida mot tom taktikeditor.** Två olika frågor; ingen ändring av editorns tomma start.
- **Tema och logga.** Ingen ny temakonvertering är beställd, bara kontrastkontroll.
- **"Förslag 7" (hårdare koppling match–taktiktavla) är uttryckligen undantaget** och ska inte blandas ihop med roadmapens etapp 7.
- **Mottagartext.** Vyn säger att kallelser bara går till spelare, medan systemet även notifierar aktiva vårdnadshavare – texten behöver rättas (O01). E-post och push är inte aktiverade och får inte beskrivas som levererade (O02).

## Mina förslag – i ordning

1. Rätta de två småfelen (punkt 1–2 ovan) – liten insats, tydlig risk.
2. Rätta mottagartexten om vilka som nås av en kallelse (O01) och håll kvar den tydliga upplysningen om att kallelser bara finns i appen.
3. Förtydliga vad "Klar" betyder på matchplanen utan att införa nytt truppkrav (O03).
4. Kör en fullständig mottagarkedja med separata konton och dokumentera resultatet per FR-punkt.
5. Ta beslut om kunskapsbankens motstridighet (KB043/KB002/åldrar) innan fler artikeländringar görs.
6. Ta taktikkortens innehållsrättningar som ett eget, avgränsat arbete (20 kort, 60 steg) – inte tillsammans med säkerhetsrättningar.

## Tekniska detaljer

- Punkt 1: `src/routes/_authenticated/team.$teamId.event.$eventId.tsx` – ersätt `const meta = list[0]` med val av senaste aktiva (ej återkallade) kallelse.
- Punkt 2: `src/routes/_authenticated/team.$teamId.narvaro.tsx` – låt "Färdigställ" bygga `finalDraft` och skicka det som argument till mutationen i stället för `setDraft` + `setTimeout`.
- Punkt 3 (O01): `src/components/CoachInvites.tsx` och `src/routes/_authenticated/planera-match.tsx` – texten ska nämna att aktiva vårdnadshavare också nås i appen.
- Punkt 4 (O03): `src/lib/plan-status.ts` etiketter/hjälptext, inga regeländringar.
- Ingen ändring av databasfunktioner behövs för punkt 1–4; verifiering sker med befintlig testsvit plus riktade tester.
