# Resultatbaserad träningsplanering och tydliga övningsguider

## Mål
Göra träningsplaneringen styrd av vad spelarna ska utveckla, inte bara av vilka övningar som ingår. Efter att ett pass skapats ska tränaren kunna öppna det och direkt förstå hur varje övning byggs upp och genomförs.

## Det här byggs

### 1. Färdiga fokusområden för träningspasset
- Ersätt fri inmatning av tema med tydliga, klickbara val där flera kan markeras.
- Använd en fast uppsättning relevanta val, exempelvis:
  - Passningar och mottagning
  - Dribbling och bollkontroll
  - Avslut
  - Spelbarhet och rörelse
  - Försvarsspel
  - Press och återerövring
  - Omställningar
  - Målvakt
  - Spelförståelse
  - Samarbete och kommunikation
- Visa valda fokus tydligt när passet skapas, redigeras, granskas, visas och genomförs.
- Behåll befintliga teman som redan är sparade och mappa vanliga värden till de nya valen där det går, så inget arbete försvinner.

### 2. Mål kopplat till fokus
- Behåll målsättningen “Vad ska spelarna kunna efter passet?” som ett konkret resultat för hela träningen.
- Placera fokusområden och målsättning tillsammans överst i träningspasset.
- Markera tydligt om fokus eller målsättning saknas innan passet betraktas som färdigplanerat.

### 3. Full övningsguide i det sparade träningspasset
Varje övning ska kunna visa:
- Syfte
- Yta och antal spelare
- Utrustning
- Uppställning, inklusive hur koner och mål placeras
- Genomförande steg för steg
- Tränarpunkter
- Frågor till spelarna
- Förenkla
- Försvåra
- Tecken på att övningen fungerar
- Säkerhet

Guiden visas direkt i passets visningsläge och i vyn där tränaren visar övningarna för spelarna. Innehållet delas upp med tydliga rubriker så det går snabbt att läsa på planen.

### 4. Egna övningar får samma struktur
- Utöka “Skapa egen övning” så tränaren kan beskriva uppställning, genomförande, tränarpunkter, förenklingar och utmaningar.
- Behåll bara titel och tid som obligatoriska; övriga detaljer är frivilliga.
- Behåll snabbvalen för utrustning och gör det möjligt att ange koner och mål tydligt i uppställningen.
- Visa en komplett förhandsgranskning innan övningen läggs till.

### 5. Samma information i alla träningsflöden
- Använd samma övningsguide i Mina träningar, planeringen av ett kalenderlagt träningstillfälle, utskrifts-/PDF-vyn och Truppens “Visa för spelarna”.
- För övningar från Träningsbanken hämtas den redan befintliga fullständiga guiden.
- För egna övningar används tränarens sparade uppgifter.
- Äldre pass utan fullständiga uppgifter fortsätter fungera och visar de delar som finns.

## Teknisk lösning
- Lägg strukturerade fokusområden på träningspass och träningsplaner, med bakåtkompatibel hantering av befintligt tema.
- Utöka egna övningar med strukturerade guidefält.
- Spara en detaljkopia på passets övningsrad när en bankövning läggs till. Då förändras inte ett redan planerat pass om Träningsbanken senare uppdateras.
- Skapa en gemensam komponent för övningsguiden, så samma rubriker och innehåll används i alla relevanta vyer.
- Behåll nuvarande behörigheter: endast godkända tränare får skapa och ändra planeringen.

## Verifiering
- Testa skapande och redigering med flera fokusområden.
- Testa en bankövning och en egen övning med full guide.
- Kontrollera att sparade detaljer finns kvar efter omladdning och återinloggning.
- Kontrollera visningsläge, utskrift/PDF, genomförande och Truppens spelarvisning på dator och mobil.
- Kontrollera att äldre träningspass fortfarande öppnas utan fel.
