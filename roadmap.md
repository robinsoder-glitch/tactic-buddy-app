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
- [ ] Genomgång av sajten: prioriterade förbättringsförslag (se Etapp 2–5 nedan)


## Etapp 2: Ljust designsystem
- [ ] Ljust standardtema (bakgrund #F5F8F2, kort #FFFFFF, primär #2F6B4F, text #1E2B23)
- [ ] Temaval: Ljust (standard), Följ enheten, Mörkt
- [ ] Systemtypsnitt i stället för kondenserad display, meningsform i rubriker (inga versaler)

## Etapp 3: Navigation
- [ ] Mobil: Hem, Taktik, Träning, Kunskap, Mer
- [ ] Dator: toppnavigation i stället för bottenmeny
- [ ] Lagets nio flikar → Översikt, Aktiviteter, Trupp, Närvaro, Laginställningar
- [ ] Tillbaka-länk till föregående nivå

## Etapp 4: Sidor
- [ ] Startsida: hälsning med visningsnamn, rätt undertitel på Taktikbanken, tre huvudvägar, "Aktivt lag"-etikett, max 3 senaste taktiker
- [ ] Ny taktik: 5 mot 5 / 7 mot 7 / 9 mot 9 / 11 mot 11, ett steg, "Skapa och öppna tavlan"
- [ ] Mina taktiker: spelform i modern text, hela kortet klickbart, meny (Byt namn, Duplicera, Dela, Exportera, Radera)
- [ ] Filterpanel "Fler filter" + "Rensa filter" + antal aktiva filter i alla banker
- [ ] Övningsbank: nyckeltal på kort (spelare, yta, tid, utrustning), riktiga detaljsidor
- [ ] Kunskapsbank: fylligare intern sammanfattning (Passar dig som, Huvudbudskap, Praktiska råd, Vad artikeln inte svarar på, källkontroll)
- [ ] Editorn: förskjutning av nya spelare, "Lägg till steg", tydliga verktygsetiketter, enklare tidsvisning, "Sparat"-indikator, helskärm på mobil
- [ ] Spelarbank: förklaring mot lagets trupp, "Symbolfärg: eget lag/motståndare"
- [ ] Träningspass: drag-sortering, koppling till lagets kalender, kontroll före genomförande
- [ ] Kalender/träning/match/närvaro/statistik enligt granskningens tabell

## Etapp 5: Generell kvalitet
- [ ] Tomma lägen med förklaring och huvudhandling
- [ ] Aria-label på ikonknappar
- [ ] Inställningar delade i Profil, Taktiktavla, Utseende, Integritet, Konto
- [ ] Visningsnamn i profilen i stället för e-post
