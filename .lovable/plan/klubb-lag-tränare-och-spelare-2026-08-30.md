# Klubb, lag, tränare och spelare

Utökar Taktiktavlan från ett personligt verktyg till en lagplattform med tre kontotyper: admin, tränare/lagledare och spelare.

## Konton och roller

- **Tränare/lagledare**: anger födelsedatum vid registrering + intygar att uppgiften stämmer. Under 18 år blockeras. Skapar klubb och lag, hanterar trupp, träningar och matcher.
- **Spelare**: registrerar sig och anger en **lagkod** som tränaren fått när laget skapades. Spelaren hamnar i status "väntar på godkännande" tills tränaren godkänner i truppvyn. Spelarvyn är read-only.
- **Admin**: separat roll som ger läsbehörighet över alla klubbar, lag, tränare och spelare.

Roller lagras i en egen roll-tabell (aldrig på profilen) för att undvika behörighetsproblem.

## Tränarens vyer

- **Profil**: namn, bild, lista över de lag tränaren har (med lagbild).
- **Laget** (fliknavigering enligt bifogad bild): Truppen, Om laget, Kalender, Träningar, Matcher, Bilder — vi bygger Truppen, Om laget, Kalender och Träningar nu; Matcher och Bilder läggs som förberedda flikar.
- **Truppen**: lägg till spelare med namn, ålder, kön (pojke / flicka / inget alternativ) och bild. Inga fält är obligatoriska utom namn. Här godkänns även spelare som angett lagkoden.
- **Träning**: skapa träningstillfällen med datum/tid, plats och ett "Övrigt"-fält (t.ex. "ta med regnkläder"). Syns direkt för lagets spelare.
- **Kalender**: samlad lista/månadsvy över träningar (och senare matcher).

## Spelarens vy

Read-only profil med flikarna Truppen, Kalender, Träningar och Matcher. Ingen redigering. Strukturen görs generisk så att fler funktioner (närvaro, meddelanden, statistik) kan läggas till senare.

## Taktiktavlan kopplas ihop

- En taktik kan höra till ett lag.
- Lagets trupp blir spelarbanken i taktikeditorn — tränaren slipper mata in spelare två gånger.
- Delade taktiker kan visas för lagets spelare, utöver dagens publika länk.

## Adminvy

Egen sida `/admin` med lista över alla klubbar, lag, tränare och spelare samt sökning. Endast läsning i detta steg.

## Teknisk plan

Databas (migration, RLS + GRANTs på varje ny tabell):

- `app_role` enum (`admin`, `coach`, `player`) + `user_roles` + `has_role()` security definer-funktion.
- `profiles` utökas med `birth_date`, `avatar_path`, `is_adult_confirmed`.
- `clubs` (namn, ort, logga).
- `teams` (club_id, namn, åldersgrupp, kön, lagbild, `join_code` unik).
- `team_members` (team_id, user_id nullable, roll `coach`/`player`, status `pending`/`approved`).
- `players` utökas med `team_id`, `age`/`birth_date`, `gender`; behåller `user_id` för bakåtkompatibilitet.
- `events` (team_id, typ `training`/`match`, starttid, plats, `notes`).
- `tactics` får `team_id` (nullable).

Policies: tränare får full åtkomst till sina lags rader via `team_members`-medlemskap med rollen coach (via security definer-funktion för att undvika rekursion), spelare får läsa sitt lags rader när status är approved, admin får läsa allt via `has_role`.

Frontend (TanStack Start-rutter under `_authenticated`):

- `/onboarding` — välj kontotyp, födelsedatum för tränare, lagkod för spelare.
- `/team/$teamId` med flikarna som underrutter.
- `/admin` bakom rollkontroll.
- Spelarens vyer återanvänder samma komponenter i read-only-läge.
- Spelarbilder till befintlig privat `player-photos`-bucket; lag- och profilbilder till en ny privat bucket.

Allt UI på svenska och i befintligt mörkt tema.
