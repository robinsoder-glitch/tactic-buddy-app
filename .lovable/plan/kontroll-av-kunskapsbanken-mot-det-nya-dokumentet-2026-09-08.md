# Kontroll av kunskapsbanken mot det nya dokumentet

Dokumentet med 112 artiklar är jämfört fält för fält mot de 112 artiklar som redan ligger i kunskapsbanken.

## Resultat av kontrollen

- Alla 112 artiklar (KB001–KB112) finns redan inlagda. Inget saknas, inget behöver läggas till.
- Inga dubbletter: 112 unika ID, 112 unika länkadresser, 112 unika webbadresser.
- 104 artiklar stämmer exakt med dokumentet, inklusive rubriker, texter, ålders- och spelformsfilter, nivå, kategori, källa, lästid, datum och sortering.
- 3 artiklar skiljer sig på riktigt (KB043, KB066, KB081). Det beror på att vi vid förra importen medvetet behöll den befintliga, utförligare texten.
- 5 artiklar (KB024, KB034, KB091, KB095, KB103) såg först ut att skilja sig men gör det inte – skillnaden var bara hur tecknet "&" skrivs i dokumentfilen.

## De tre artiklar som skiljer sig

| Artikel | Nu i kunskapsbanken | Enligt dokumentet |
| --- | --- | --- |
| KB043 Fem tips till dig som är föräldratränare | Poddavsnitt, 25 min, kontrollerad 2026-09-04, längre text | Annan rubrik och kortare text, 4 min, 2026-08-30 |
| KB066 Tränarresurser med enkla färdiga pass | Innehållstyp "Resursbank" | Innehållstyp "Artikel och guide" |
| KB081 CoachMate: planera pass och led laget | Innehållstyp "Verktyg", längre sammanfattning | Innehållstyp "App och resursbank", kortare sammanfattning |

## Förslag på åtgärd

1. Behåll de utförligare texterna för KB043 och KB081 – de ger läsaren mer än dokumentets kortare versioner.
2. Ändra innehållstyp för KB066 till "Artikel och guide". Den benämningen används redan av 20 andra artiklar, så filtret blir tydligare.
3. Behåll "Verktyg" för KB081 istället för att införa den helt nya benämningen "App och resursbank", så att listan med innehållstyper inte växer i onödan.
4. Ingenting utanför kunskapsbanken ändras.

## Teknisk detalj

En enda uppdatering på `public.knowledge_articles` för KB066 (`content_type`). Övriga rader lämnas orörda. Efter ändringen körs en kontroll av totalantal, publicerade, unika slugs och webbadresser samt fördelning per kategori och nivå.
