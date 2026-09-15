# Åtgärder efter morgonunderlaget 15 september

Alla punkter gäller befintliga funktioner. Inga nya sidor, huvudmenyval eller notiskanaler.

## Säkerhet och verifiering

1. **Q01 – formateringsfelet stoppar kontrollen.** Rätta radbrytningen i `src/lib/capacitor.ts` så att `npm run lint` går igenom igen (kvarvarande 17 varningar är befintliga).
2. **S01 – interna IPv6-adresser.** Adresskontrollen i matchimporten känner inte igen `::ffff:7f00:1` eller den utskrivna loopbacken `0:0:0:0:0:0:0:1`. Kontrollen normaliserar IPv6 (inklusive hexform av IPv4-mappade adresser och fullt utskriven `::1`) och behandlar dessutom ett misslyckat namnuppslag som ett stopp i stället för att fortsätta hämta. Nya tester för båda formaten.

## Träningspass

3. **N03 – avslut under paus.** Pågående paus räknas med i pausad tid vid avslut, så aktiv tid inte hoppar upp. Ny migration.
4. **N04 – fel lag på aktiviteten.** Start av ett genomförande kontrollerar att kalenderaktiviteten hör till samma lag som passet och att tränaren har behörighet där; annars avslag utan delvis sparad data.
5. **N05 – upprepat avslut.** Ett redan avslutat genomförande lämnas orört i stället för att skriva om sluttid och närvaro.
6. **N06 – aktivitetsvalet.** Startknappen spärras även när kopplingarna inte kunde hämtas, och inställda aktiviteter väljs inte som koppling.
7. **K03 – osparat pass.** Samma utkastspärr som bankknappen används även för Visa, Genomför och Tillbaka.

## Taktik och import

8. **K01 – taktiktavlans sparande.** Omhämtad taktik skriver inte över lokala ändringar som gjorts efter att sparandet startade; "Sparat" visas bara när det som ligger på servern är det senaste.
9. **M04b – importdialogen under sparning.** Dialogen går inte att stänga mitt i ett sparande (tydligt besked i stället), och en avbruten körning kan inte fylla på en senare öppnad dialog.

## Fel som visas som tomt

10. **E01 + K10.** Statistik, periodplan och bilder skiljer hämtfel från tomt innehåll och visar ett felmeddelande med möjlighet att försöka igen. Misslyckad bildradering ger tydligt fel i vyn.

## F03 – React-varning i publicerad version

Felsöks separat: jag letar upp var serverns och webbläsarens första rendering skiljer sig (start, inloggning, kalender) och rättar orsaken om den går att belägga. Går den inte att belägga rapporterar jag det i klartext i stället för att påstå en rättning.

## Verifiering

`bunx vitest run`, `bunx tsgo --noEmit`, `bun run build` och `npm run lint` ska alla gå igenom, plus nya tester för adresskontrollen, avslut under paus och upprepat avslut.
