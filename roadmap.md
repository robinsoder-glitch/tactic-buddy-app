# Roadmap

## Klart
- Kunskapsbank: tabell `knowledge_articles` + import av 50 granskade artiklar (idempotent).
- Kunskapsbankens översikt (sök, kategori-, ålders- och spelformsfilter, utvalda) och detaljvy `/kunskapsbank/:slug`.
- Svenska etiketter i Taktikbank/Övningsbank (spelmoment, faser, roller, tränarfråga).
- Regellänken under "Mer innehåll" visas bara för admin.
- Mobilmeny med fem val (Hem, Taktikbank, Övningsbank, Kunskapsbank, Mer).
- Tester för etiketter, innehållsmängder, meny och kunskapsbankens filter.
- Kopplat innehåll mellan bankerna (`content_links`): relaterade avsnitt på artikel, taktikkort och övning, admin-verktyg, favoriter på artiklar.

## Kvar
- Inget öppet.


## Mina träningspass (klart)
- Tabeller `coach_sessions` + `coach_session_items` med RLS per tränare.
- `/traningspass` lista, `/traningspass/$id` byggvy, `/traningspass/$id/visa` körschema med utskrift/PDF.
- "Lägg till i träningspass" på taktikkort, övningar, målvaktsövningar och artiklar.
- "Använd som mall" kopierar redaktionella pass (originalen orörda).

- [x] Närvaro per händelse (event_attendance) och statistikvy per lag med CSV-export
