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
- [ ] Instruktion 6: rätta sekvens- och animationsfel i Taktiktavlan enligt uppladdad specifikation.
