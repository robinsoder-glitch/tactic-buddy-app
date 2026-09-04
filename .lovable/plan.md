# Fyra P0-rättningar

Fyra avgränsade rättningar i angiven ordning. Ingen designändring, inga nya funktioner utöver det som krävs.

## 1. Datum försvinner när träning eller match sparas

Datumfältet saknar ett namn, så när formuläret läses av blir datumet tomt trots att användaren valt ett.

- Datumfältet får en valfri `name`-egenskap som skickas vidare till inmatningsrutan.
- Aktivitetsformuläret anger `name="date"` på datumfältet.
- Fältet förblir styrt av `value`/`onChange`, snabbvalen Idag/Imorgon/Om en vecka påverkas inte.

Tester: nya renderingstester som skapar och redigerar både träning och match och kontrollerar att datumet följer med, samt att tomt datum ger valideringsfel.

## 2. Delade taktiker får inte visa spelaruppgifter

Idag läser utloggade besökare hela taktikens innehåll direkt, inklusive spelar-id, namn, tröjnummer och foto-URL.

- Ny migration: stäng av anonym direktläsning av taktiker och deras bilder, och lägg i stället in en säker databasfunktion som hämtar en delad taktik via delningsnyckeln.
- Funktionen tar bort spelar-id och foto-URL och byter ut riktiga namn mot neutrala etiketter (Spelare 1, Spelare 2 … respektive tröjnummer). Anonymiseringen sker i databasen, inte i webbläsaren.
- Funktionen returnerar ingenting när delning är avstängd, så en avstängd länk slutar fungera direkt.
- Delningssidan hämtar via den nya funktionen; ägarens egen tavla är oförändrad och visar full data.
- Delningsdialogen får en tydlig rad om att fritextanteckningar visas publikt.

Tester: enhetstester för anonymiseringen (etiketter, borttagna fält, tomma listor) och direkta databaskontroller att anon och inloggad utan behörighet inte kan läsa taktiker eller bilder.

## 3. Skydda spelarkod och tränarkod

Koderna ligger i lagraden och följer med i de allmänna lagfrågorna, och den som har en obehandlad ansökan kan läsa lagraden.

- Ny migration (befintliga migrationer rörs inte): skyddad databasfunktion som lämnar ut lagets koder endast till godkänd tränare/huvudtränare i just det laget, plus en funktion för att rotera en kod.
- Lagpolicyn skärps så att en obehandlad ansökan bara ger den minimala laginformation ansökningsvyn behöver.
- Applikationens allmänna lagfrågor slutar hämta kodfälten; kodrutorna i lagvyn hämtar dem via den skyddade funktionen.
- Alla befintliga tränarkoder roteras en gång i migrationen eftersom de kan ha varit läsbara. Ingen annan lagdata ändras.

Tester: enhetstester för koddatalagret plus direkta databaskontroller för anon, obehandlad medlem, godkänd spelare, vårdnadshavare, tränare i eget lag och tränare i annat lag.

## 4. Godkännande utan namnmatchning

Godkännandet gissar idag rätt spelarkort utifrån namn och tar det första träffen, och godkänner även när ingen träff finns.

- Ny migration med en ersättande version av godkännandefunktionen som tar emot ett uttryckligt spelarkort när rollen är spelare eller vårdnadshavare.
- Innan något ändras kontrolleras: ansökan är fortfarande obehandlad, tränaren är behörig, spelarkortet tillhör samma lag, kortet får kopplas till personen, och kopplingen skapar ingen dubblett. Raderna låses och allt sker i samma transaktion – vid fel rullas allt tillbaka och ansökan förblir obehandlad. Notisen skickas sist.
- Namnmatchning tas bort helt.
- Tränarens vy för ansökningar får en obligatorisk lista där rätt spelarkort väljs innan Godkänn blir aktiv, med tröjnummer visat så att två lika namn går att skilja åt. Ingen kod väljer automatiskt.

Tester: enhetstester för vallogiken (inget kort valt, ett kort, två lika namn, kort från annat lag) och databaskontroller för tränare, spelare, vårdnadshavare, dubblettnamn och obehörig användare.

## Avslutning

Hela testsviten, TypeScript-kontroll och build körs efteråt, och kalender, Mina lag, registrering och taktiktavlan gås igenom i appen. Redovisning av ändrade filer, migrationer och testresultat lämnas i svaret.

## Öppen fråga

Om rollen är spelare eller vårdnadshavare men det saknas passande spelarkort: förslaget är att godkännande blockeras tills tränaren skapat kortet. Säg till om du hellre vill kunna godkänna utan koppling.
