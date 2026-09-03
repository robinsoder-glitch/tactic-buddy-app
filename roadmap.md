# Roadmap – granskning 2026-08-30

## Etapp 1: Säkerhet, integritet och städning
- [x] Arkivera/radera lag (stark bekräftelse) + radera testlaget "TEST – fullständig kontroll"
- [x] Lagets skapare syns som ägare/ledare
- [x] Personliga inbjudningar: engångstoken, utgångstid, återkallande. Lagkod ger aldrig ledarroll
- [x] Minimera barnuppgifter: födelseår i stället för fullt datum, foto frivilligt med tydlig text
- [x] Ny lagkod ("Skapa ny kod") och kodens giltighet i Om laget
- [x] Dölj all felsökningsinfo för vanliga användare (bara admin eller utvecklingsläge)
- [x] Rollförklaring, ägaröverlåtelse och begripliga svenska felmeddelanden
- [x] Omfattande test av bildintegritet (spelarbilder, lagbilder, direkta URL:er) – src/lib/photo-access.test.ts
- [x] Verifiera att rollkontroller är SECURITY DEFINER med låst search_path + minimerade EXECUTE-rättigheter
- [x] Genomgång av sajten: prioriterade förbättringsförslag (se Etapp 2–5 nedan)


## Etapp 2: Ljust designsystem
- [x] Ljust standardtema (bakgrund #F5F8F2, kort #FFFFFF, primär #2F6B4F, text #1E2B23)
- [x] Temaval: Ljust (standard), Följ enheten, Mörkt
- [x] Systemtypsnitt i stället för kondenserad display, meningsform i rubriker (inga versaler)

## Etapp 3: Navigation
- [x] Mobil: Hem, Taktik, Träning, Kunskap, Mer
- [x] Dator: toppnavigation i stället för bottenmeny
- [x] Lagets nio flikar → Översikt, Aktiviteter, Trupp, Närvaro, Laginställningar
- [x] Tillbaka-länk till föregående nivå

## Etapp 4: Sidor
- [x] Startsida: hälsning med visningsnamn, rätt undertitel på Taktikbanken, tre huvudvägar, "Aktivt lag"-etikett, max 3 senaste taktiker
- [x] Ny taktik: 5 mot 5 / 7 mot 7 / 9 mot 9 / 11 mot 11, ett steg, "Skapa och öppna tavlan"
- [x] Mina taktiker: spelform i modern text, hela kortet klickbart, meny (Byt namn, Duplicera, Dela, Exportera, Radera)
- [x] Filterpanel "Fler filter" + "Rensa filter" + antal aktiva filter i alla banker
- [x] Övningsbank: nyckeltal på kort (spelare, yta, tid, utrustning), riktiga detaljsidor
- [x] Kunskapsbank: fylligare intern sammanfattning (Passar dig som, Huvudbudskap, Praktiska råd, Vad artikeln inte svarar på, källkontroll)
- [x] Editorn: förskjutning av nya spelare, "Lägg till steg", tydliga verktygsetiketter, enklare tidsvisning, "Sparat"-indikator, helskärm på mobil
- [x] Spelarbank: förklaring mot lagets trupp, "Symbolfärg: eget lag/motståndare"
- [x] Träningspass: sortering upp/ned, koppling till lagets kalender, kontroll före genomförande
- [x] Kalender/träning/match/närvaro/statistik enligt granskningens tabell

## Etapp 5: Generell kvalitet
- [x] Tomma lägen med förklaring och huvudhandling
- [x] Aria-label på ikonknappar
- [x] Inställningar delade i Profil, Taktiktavla, Utseende, Integritet, Konto
- [x] Visningsnamn i profilen i stället för e-post

## Etapp 1: Kallelser och deltagarsvar
- [x] Datamodell: event_invitations, event_invitation_log, app_notifications, events.cancelled_at
- [x] RLS: ledare hanterar lagets kallelser, spelare läser/svarar bara på sin egen
- [x] Skapa/hantera kallelse på aktivitetens detaljsida
- [x] Deltagaröversikt: Kommer / Kommer inte / Kanske / Ej svarat med filter och nyckeltal
- [x] Ledare registrerar och korrigerar svar med ändringshistorik
- [x] Sidan "Mina kallelser"
- [x] Påminnelse som intern notis (inga mejl/SMS/push)
- [x] Inställd aktivitet blockerar nya svar
- [x] Tester för kallelser
- [x] Kalendern och närvarosidan länkar till kallelsen

## Etapp 6: Koppling bank → kalender
- [x] Koppla övning/målvaktsövning/taktik/artikel direkt till en träning i lagets kalender (välj aktivitet + minuter)
- [x] "Lägg till i träning" på alla kort i banken, inte bara träningspass
- [x] Byt namn: "Ny taktik" → "Ny övning" i hela appen

- [x] Kunskapsbanken: ta bort knapparna för att lägga till artiklar i träning/träningspass (inget ska kunna läggas till därifrån).

## Etapp 6: Rättningar 2026-08-30 (kväll)
- [x] Sista svarsdag i kallelser sparas och visas på svenska (verifierat mot databasen)
- [x] Verifiera att inga "Lägg till träningspass"/"Lägg till träning" finns kvar i Kunskapsbanken
- [x] Automatiskt test som failar om knapparna återkommer i Kunskapsbanken
- [x] Tydlig uppdatering/cache-busting så senaste versionen visas utan hård omladdning
- [x] Ta bort "Sista svarsdag" helt från gränssnittet (databasfältet respond_by behålls) — etapp 1 klar

## Etapp 7 – Skapa träning (aug 2026)
- [x] Kalenderfält i "Skapa träning" som kopplar träningen till en träning i kalendern
- [x] Borttaget: Åldersgrupp, Dela med lag, läget "Tidigare träning"
- [x] "Färdigt pass" ersatt med val av övningar från Träningsbanken
- [x] Fliken "Träningspass" borttagen i Träningsbanken

- [x] Övningar i Träningsbanken kopplade till kunskapsartiklar (content_links)
- [x] Kunskapsbanken: verifiera och testa att inga "Lägg till träning"-knappar finns kvar; automatisk versionsuppdatering

## Etapp 8 – Ny huvudnavigation (aug 2026)
- [x] Åtta flikar i ordning: Planera träning, Planera match, Taktik, Kunskap, Träningsbank, Mina kallelser, Mina lag, Inställningar
- [x] Mobil: fyra val + Meny, alla sidor nås med högst två tryck
- [x] Nya sidor: /planera-traning, /planera-match, /taktik (återanvänder befintlig tavla)
- [x] Omdirigering från /skapa och /taktikbank till /taktik
- [x] "Skapa träningspass" som primär knapp i Träningsbanken
- [x] "Planerat träningsinnehåll" visas på aktivitetssidan
- [x] Tester: navigation.test.ts (10 tester), hela sviten 166 gröna

## Kvar att göra (från spec 2026-09-01)
- [x] Instruktion 6: rätta sekvens- och animationsfel i Taktiktavlan enligt uppladdad specifikation.

## Spec 2026-09-02 (nattlig instruktion)
### Prioritet 1 – Taktiktavlans sekvenser
- [x] Startläge separerat, sekvens = målpositioner efter övergången
- [x] "Ny sekvens" lägger alltid sist; "Infoga sekvens efter denna" endast i Avancerad
- [x] Flytta/Löpning/Passning skapar aldrig sekvens, skriver till aktiv sekvens
- [x] transitionPaths tillhör målsekvensen; Spela detta steg N = N-1 → N
- [x] Stabila UUID:n, parallell interpolation, test som failar om drag ändrar antal sekvenser
### Prioritet 2 – Navigering
- [x] /taktikbank ren listvy utan databasskrivningar
- [x] /skapa visar val (Tom taktik / Mall) innan något skapas
- [x] Startsidan: "Ny taktik" + separat "Skapa träningspass"
### Prioritet 3 – Kalender och sidfel
- [x] Typ-badge och titel separat (aldrig MatchMatch), Inställd som egen badge
- [x] Matchsidans rubrik "Matchplanering", matchspecifika placeholders
- [x] Kallelser grupperade per aktivitet, spelarnamn vid flera kopplingar, tomläge "Inga tidigare kallelser"
- [x] Lagägare i ledarlistan, en Skapa träning-knapp, tooltips/aria-label, lösenordsdialog
### Prioritet 4 – Kunskapsbanken
- [x] Filter: Sök, Ämne, Åldersgrupp, Nivå (nivåmappning Grund/Fortsättning/Fördjupning)
- [x] 12 artiklar + "Visa fler", förenklade kort
- [x] Artikelsidan enligt ny ordning, borttagna redaktionella fält

## Instruktion 10 + rättning 2026-09-02
- [x] Kunskapsbanken: flik "Vanliga misstag" med 10 punkter + källor
- [x] Taktik: planen ska vara tom när man öppnar tavlan (inga förifyllda spelare)

- [x] Träningsplanering: nya övningar från Träningsbanken raderade tidigare sparade övningar (utkastet saknade grundraderna).
- [x] Publicera appen så att tom taktiktavla-fixen når skarpa sajten.

## Etapp 11: QA 2 september 2026
- [x] Global tillbakaknapp på alla sidor (inklusive inloggning och skapa konto)
- [x] Taktiktavlan: gå att placera ut bollen igen (guiden blockerade klick)

## Instruktion 10D – Komplett matchplanering
- [x] Öppna match: Ej klar (röd) öppnar Planera match; Klar (grön) öppnar läsläge med Ändra
- [x] Läsläge: motståndare, hemma/borta, plats, datum, samling, matchstart, ledare, spelarsvar, uttagna, formation, startelva, avbytare, kopplad taktik
- [x] Steg 1 matchuppgifter (samling före matchstart)
- [x] Steg 2 ledare (förvalda vid redigering, inga dubbletter, riktig borttagning)
- [x] Steg 3 spelare sorterade Kommer/Kanske/Ej svarat/Kan inte + varning vid "Kan inte" + antal som krävs
- [x] Steg 4 formation 3v3–11v11, drag till plan, bänk, unika spelare, Tom plats
- [x] Steg 5 granska + atomisk sparning (RPC save_match_plan), grön Klar direkt
- [x] Ändra: förifyllt, varning om borttagen spelare låg på planen, Avbryt oförändrat
- [x] Dela laguppställning: skrivskyddad länk (match_shares + get_shared_match), återkallelse, slutdatum, inga privata uppgifter
- [x] Acceptanstester (live): 3v3-sparning med ledare+4 spelare, reload visar identisk data, grön Klar-etikett, läsläge, dubblettskydd/validering via enhetstester (273 gröna)
- [x] Rättat: tryck-placering i MatchLineupEditor (pointerdown avmarkerade valet), svars­summering räknar uttagna utan kallelserad som Ej svarat, klickbara ledar-/spelarrader
- [x] Live-testat 2026-09-03: 5v5/7v7/9v9/11v11 + 3v3 sparade och lästes tillbaka korrekt; validering avvisar dubbletter, fel antal, position utanför plan och avbytare som står på plan

## Instruktion 10E – Genomför träning
- [x] Starta träning: exakt ett aktivt genomförande, Fortsätt pågående
- [x] Genomförandeskärm: rubrik, aktuell övning, stor timer, instruktion, därför, material, organisation, nästa övning, taktiktavla/bild
- [x] Kontroller: Pausa/Fortsätt/Föregående/Nästa/Hoppa över/+1 min/Avsluta (stora, mobil)
- [x] Timer: beräknad från started_at + pauser + justeringar, spara vid händelser (ej varje sekund)
- [x] Närvaro i genomförandet (unik per aktivitet+spelare, upsert)
- [x] Anteckningar: allmän + privata spelarobservationer, autospara med felhantering
- [x] Avsluta med bekräftelse: spara faktiska tider, moment, närvaro, anteckningar; status Genomförd
- [x] Sammanfattning + Till träningsplanering
- [x] Edge cases + acceptanstest

## Instruktion 10F – Periodplan och spelarutveckling
- [x] Periodblock 4–6 veckor: namn, datum, huvudtema, max 2 delteman, mål
- [x] Koppla träningar/matcher/övningar/taktiker/artiklar (unik per period)
- [x] Progression 4 steg: Introducera/Öva/Använd i spel/Följ upp + föregående periods tema
- [x] Privat spelarvy: max 3 aktiva fokusområden, status Aktivt/Uppnått/Pausat, barnanpassat språk
- [x] Observationer kopplade till aktivitet/fokusområde, snabbregistrering
- [x] Integritet: RLS, inga anteckningar i delningslänkar, vårdnadshavare ser inte internt
- [x] Lagöversikt utan topplista: antal med/utan fokus, senaste observation, periodteman
- [x] Återanvänd närvaro/speltid från genomförda aktiviteter
- [x] Acceptanstester

## Instruktion 10G – Backlogbedömning (ingen kod)
- [x] Bedöm framtida funktioner i tabell (docs/backlog-10g.md)
- [x] Byggordning + arkitekturpåverkan + barnrisker
- [x] Implementera INGET förrän nytt beslut

## Slutgranskning 2026-09-02 (nattlig instruktion)
- [x] Gå igenom hela sidan: alla 35 sidor laddade utan runtime-fel (endast känd hydration-varning)
- [x] Periodplan live-testad: skapa period, progression sparas och finns kvar efter omladdning
- [x] Genomför träning live-testad: start, paus, fortsätt, nästa, timer efter omladdning, avsluta + sammanfattning
- [x] Fixat: periodplanen visar närmaste period även när ingen pågår just nu
- [x] Fixat: sammanfattningen visas efter avslutad träning (tidigare dolde tomma läget dialogen)
- [x] Testdata rensad efter genomgången
- [x] Säkerhet: interna triggerfunktioner går inte längre att anropa; kvarvarande SECURITY DEFINER-funktioner är RLS-hjälpare och RPC:er med egna behörighetskontroller
- [x] Live-testat 2026-09-03 (två riktiga konton/lag):
  - [x] 3v3–11v11 fullskaligt: sparning + återläsning identisk
  - [x] Giltig delningslänk utloggad: visar match, formation, nummer och namn – inga e-post/telefon/anteckningar; återkallad länk ger tomt
  - [x] RLS mellan två lag: läsning av annat lags spelare/aktiviteter/kallelser ger 0 rader, sparning nekas ("Endast lagets tränare..."), insert nekas av RLS; anonym direktläsning ger 0 rader
  - [x] Påminnelse-debounce: tre parallella tryck skapar nu exakt en notis (fixat med lås per aktivitet i send_invite_reminders)

## Akutlista 2026-09-03
- [x] Tränare ska aldrig se "Väntar på godkännande" i sitt eget lag
- [x] Notisprick (röd siffra) för nya medlemsansökningar i menyn och på Mina lag
- [x] "Radera alla taktiker"
- [x] Spara matchplan → tillbaka till matchlistan
- [x] Rätta registrering och lagkodsflöde (spelarkod/tränarkod, 6 tecken, metadata, guardian-namn, tester)

## Extremtest 2026-09-03 (alla kontotyper och koder)
- [x] Live: tränarkonto utan kod → skapa lag → hämta spelarkod/tränarkod
- [x] Live: spelarkonto med spelarkod
- [x] Live: vårdnadshavarkonto med spelarkod (Hej Maria, barn Elias separat)
- [x] Live: tränarkonto med tränarkod
- [x] Live: felfall – fel kodtyp, 5/7 tecken, ogiltig kod (knappen låst)
- [x] Klicktest taktiktavlan: placera spelare, spara, ladda om och öppna igen – mus och touch
- [x] Kod-/DB-genomgång + build och lint gröna

## Kunskapsbanken – kvalitetsrensning 2026-09-03
- [x] Kontrollerade alla 100 källänkar: alla lever (tre svarar 403 mot robotar men fungerar i webbläsare)
- [x] Avpublicerade fyra sidor om utländska tränarutbildningar/länkarkiv (KB051, KB052, KB054, KB083)

## Granskningsrapport 2026-09-03 (extern QA)
- [x] Kunskapsbank: 28 nivåändringar, KB043 avpublicerad, KB091 ny kategori/sammanfattning
- [x] Kunskapsbank: nya sammanfattningar KB048, KB050, KB069, KB072, KB081; direktlänkar KB053, KB064
- [x] Kunskapsbank UI: åldersetiketter borta, tydlig märkning Artikel/Forskning/Resursbank/Verktyg, källa vid knappen
- [ ] P0: godkänd spelare/vårdnadshavare ska automatiskt kopplas till spelarpost (approve_team_join_request)
- [ ] KB043: sammanfatta poddavsnittet och publicera igen

## Etapp 2 – Smart inbjudan, QR och godkännande (2026-09-04)
- [x] Personlig engångslänk: valfri e-postlåsning, mottagarnamn, koppling till spelarkort, 2–30 dagar, återkallning
- [x] Säker publik förhandsvisning (lagnamn, förening, åldersgrupp, roll, giltighetstid) utan personuppgifter
- [x] QR-kod som kodar exakt den kopierade länken, med nedladdning
- [x] Inbjudan bevaras genom inloggning/registrering (next-parameter + lokal reserv)
- [x] Vårdnadshavare får rollen guardian, aldrig player; inga dubbla medlemskap
- [x] Atomiskt godkännande (approve_team_join_request) med koppling till spelarkort och intern notis
- [x] Ansökningslistan visar namn, roll, barn, källa (spelarkod/tränarkod/personlig länk) och datum
- [x] Tester: 358 gröna, typkontroll och lint utan fel
