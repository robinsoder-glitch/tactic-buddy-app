# Instruktion 9 – Kunskapsbanken och Träningsbanken

Genomförs som ett sammanhållet paket. Artikel-id:n, övnings-id:n, favoriter och länkar från övriga appen bevaras. Taktiktavlan och planeringens datalogik rörs inte, förutom vald övningstid på planraden.

## Verifierat nuläge (kontrollerat i databasen nu)

- Nivåer: Grund 80, Fortsättning 11, Fördjupning 9 (totalt 100).
- Kategorier: Börja som tränare 11 och Fördjupning och forskning 4. Efter de två föreskrivna flyttarna blir det 12 respektive 3, vilket exakt matchar måltabellen.
- Träningsbanken: 14 övningar. Endast `d01_free_gate` och `d02_one_v_one` har spelare, yta, organisation och genomförande. Övriga 12 saknar allt detaljinnehåll.
- Instruktionen ligger idag i en stängd rullmeny (`<details>` i `DrillDetails`).
- Övningskorten öppnas bara via rubriklänken; övrig kortyta är inte klickbar.
- Fristående taktiklänkar (`/taktikbank/$cardId`) visas på övningskorten.
- Tiderna är 10/12/15 min via `default_minutes`.
- Kunskapsbankens listvy har filter för ålder utöver kategori/nivå/sök.

Den vita förhandsvisningssidan med hydration-fel är **inte** reproducerad ännu. Orsaken påstås därför inte i förväg – den utreds som första steg.

## Arbetsordning

### 1. P0: vit sida i förhandsvisning
Reproducera `/kunskapsbank` inloggad i preview, läs konsolen och hitta grundorsaken (första render server/klient, auth-/laddningsläge, klientunika värden, tema/datum/localStorage). Rätta orsaken, visa ett tydligt laddningsläge medan auth kontrolleras och undvik `suppressHydrationWarning` som täckmantel. Lägg ett smoke-test som öppnar sidan, väntar på rubriken **Kunskapsbank** och kräver tom hydration-logg.

### 2. Två omklassificeringar
Migration som sätter `kanada-resursarkiv-barnfotboll` → Börja som tränare / Grund och `teknikblock-tva-veckor` → Teknik med boll / Fortsättning. Resultat: Grund 80, Fortsättning 12, Fördjupning 8. Datatest som kräver 100 unika slugs, giltig kategori, giltig nivå och giltig original-URL per publicerad artikel, samt de exakta kategori- och nivåantalen.

### 3. Enklare listvy
Kvar i filterytan: sök, kategori, nivå och en diskret växel **Mina favoriter**. Bort: ålder, spelform, språk, källa och Utvalda. Nivåerna renderas alltid i ordningen Alla nivåer, Grund, Fortsättning, Fördjupning (fast ordning, aldrig alfabetisk). Filter speglas i URL-parametrar så att bakåt/framåt och delade länkar fungerar. Korten visar bara kategori, nivå, rubrik, kort sammanfattning, källa och lästid. Åldersdata behålls i databasen och används fortsatt under **Passar dig som**.

### 4. Enklare artikeldetalj
Ny ordning: tillbaka-länk, kategori och nivå, rubrik, kort källrad och lästid, **Passar dig som**, **Sammanfattning** (alltid synlig, 2–4 stycken byggda av befintlig sammanfattning och "Det här lär du dig"), rad med `Originalkälla: …` och en stor primärknapp **Läs vidare**. Sektionerna Huvudbudskap, Praktiska råd, Vad artikeln inte svarar på, Källa och kontroll samt rullmenyn Hela sammanfattningen tas bort ur gränssnittet. Källdata behålls internt.

### 5. Hela övningskortet klickbart
Kortet får en absolut positionerad länk över den fria ytan med synligt fokusläge, medan favoritknapp, **Lägg till i träning** och kunskapslänkarna under **Därför tränar vi detta** ligger ovanpå och behåller sina egna funktioner. Tab + Enter ska öppna kortet.

### 6. Bort med taktiklänkarna
Hela gruppen fristående `/taktikbank/...`-länkar tas bort från övningskort och övningsdetalj. **Därför tränar vi detta** och dess `/kunskapsbank/...`-länkar behålls.

### 7. Innehåll till d03–d14 och alltid öppen instruktion
Migration som fyller de 12 övningarna med spelare, yta, utrustning, organisation, genomförande, coachpunkter, frågor till spelarna, förenkla, utmana, det här vill du se och säkerhet – kort, konkret och barnanpassat utifrån befintlig titel och syfte, utan påhittade källor. `<details>Så gör du övningen</details>` ersätts med en alltid öppen sektion. Språkfelen rättas: "hur många portar man hinner på 60 sekunder", "bollberöringarna", "2 småmål eller 4 koner som mål". Validering stoppar publicering av ofullständig övning i stället för att rendera tomma rubriker.

### 8. Flexibel tid
Alla 14 övningar får `durationMin: 10`, `durationMax: 20` och visar **10–20 min** på kort och detaljsida. Vid tillägg i en planerad träning förväljs 15 minuter i ett tydligt redigerbart fält; det valda värdet sparas på planraden och bankens intervall ändras inte.

### 9. Acceptanstest
De 20 testerna körs: enhets-/datatester för artiklar och övningar samt ett Playwright-svep som loggar in, öppnar alla 100 artiklar och alla 14 övningar, kontrollerar rubriker, sammanfattning, en enda Läs vidare-knapp, filterytans innehåll, nivåordning, klickbar kortyta, frånvaro av taktiklänkar, 10–20 min och att 15 min ligger kvar på planraden efter omladdning. Resultatet redovisas test för test, inklusive kvarvarande fel.

## Teknisk sammanfattning

- Databas: två migrationer – en för artikelklassificering, en för `tb_drills` (innehåll för d03–d14, `durationMin`/`durationMax` på alla 14, språkrättningar).
- Filer som ändras: `src/lib/knowledge.ts`, `src/lib/knowledge-summary.ts`, `src/components/KnowledgeLibrary.tsx`, `src/routes/_authenticated/kunskapsbank.index.tsx`, `src/routes/_authenticated/kunskapsbank.$slug.tsx`, `src/routes/_authenticated/ovningsbank.index.tsx`, `src/routes/_authenticated/ovningsbank.$drillId.tsx`, `src/components/DrillDetails.tsx`, `src/lib/drill-quality.ts`, `src/components/AddToTrainingDialog.tsx`, plus nya testfiler.
- Redovisning efteråt: ändrade komponenter och tabeller, nivå- och kategoriantal före/efter, hur hydration-felet löstes, texterna för d03–d14 och resultatet för alla 20 acceptanstest.
