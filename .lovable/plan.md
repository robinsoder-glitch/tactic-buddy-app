# Övningar i truppen

## Mål
Ge lagets tränare en enkel vy under **Trupp** där kommande eller delade träningspass och deras övningar kan öppnas och visas för spelarna före träningen.

## Genomförande
- Lägg till ett tränarläge på truppsidan med två val: **Spelare** och **Övningar**. Spelare och vårdnadshavare behåller nuvarande truppvy utan tränarinnehåll.
- Visa lagets sparade träningspass i datumordning med titel, datum, tema, total tid och antal delar.
- När tränaren öppnar ett pass visas övningarna stort och lättläst med ordning, tid och instruktion, lämpligt att visa för hela gruppen.
- Lägg till tydliga tom- och fellägen samt en genväg till **Mina träningar** för att skapa eller ändra pass.
- Behåll befintlig åtkomstkontroll: bara godkända tränare i laget får läsa träningspassen och deras övningar.

## Teknisk lösning
- Återanvänd tabellerna för sparade träningspass och passdelar; ingen kopiering av användarnas innehåll.
- Lägg till en lagfiltrerad hämtning och en fokuserad visningskomponent på truppsidan.
- Lägg till tester för filtrering, behörighetsstyrd visning och tomlägen.
- Komplettera truppsidans sidinformation och verifiera på mobil och dator.
