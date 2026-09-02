# Ny inloggning och kontoskapande: tränare eller spelare

## Så fungerar det för användaren

**Logga in-sidan** får två tydliga val högst upp: "Jag är tränare/ledare" och "Jag är spelare eller förälder". Valet styr texter, hjälp och vad som händer efter inloggning – själva inloggningen är samma säkra e-post/lösenord eller Google.

**Skapa konto som tränare**
1. Namn, e-post, lösenord.
2. Födelsedatum och intyg om att du är minst 18 år (som idag).
3. Välj hur du kommer in i ett lag:
   - **Skapa nytt lag** (klubb, lagnamn, ålder, kön) – du blir huvudtränare direkt.
   - **Ange tränarkod** – t.ex. koden till Högalid P2018. Du hamnar som "väntar på godkännande" och en befintlig tränare i laget godkänner dig.
   - **Har du fått en inbjudningslänk** via e-post fungerar den som tidigare och godkänner dig direkt.
   - **Hoppa över** – du kan ansluta senare från Mina lag.

**Skapa konto som spelare eller förälder**
1. Namn, e-post, lösenord.
2. Vem gäller kontot? *Jag är spelaren* (13 år eller äldre) eller *Jag är vårdnadshavare* – då fyller du i spelarens namn, och kontot visas som "Elias förälder" i laget. Barn under 13 hänvisas till föräldraalternativet.
3. Ange **lagkoden** du fått av tränaren. Laget visas med namn och klubb ("Högalid P2018, Höga Liv") så du ser att du skrivit rätt kod innan du skickar ansökan.
4. Ansökan skickas – tränaren godkänner, precis som idag. Under tiden ser du en tydlig väntsida.

**Två koder per lag.** Varje lag får en spelarkod (den nuvarande) och en separat **tränarkod**. Båda visas för tränaren på lagsidan med kopiera-knapp och möjlighet att skapa ny kod om en gammal spridits. Spelarkoden ger aldrig tränarbehörighet.

**Godkännande.** Tränaren ser väntande spelare och väntande tränare på lagsidan och godkänner eller nekar. Tränaren kopplar sedan spelarkontot till rätt spelarkort i truppen (ingen automatisk matchning).

## Teknisk sammanfattning

**Databas (migration)**
- `teams.coach_join_code` – ny unik kod, sätts för alla befintliga lag.
- Uppdatera/ersätt `find_team_by_code` med en `security definer`-funktion som returnerar lag *och* vilken roll koden gäller (`player` eller `coach`), utan att läcka övriga lagdata.
- Ny `security definer`-funktion `join_team_with_code(_code)` som skapar rätt rad i `team_members` (`role` från koden, `status = 'pending'`) och sätter rollen i `user_roles`. Ersätter dagens klientsidiga kedja av anrop och gör anslutningen atomär.
- `profiles`: `guardian_for_name` (text, null) för föräldrakonton.
- Funktion för att generera ny kod (`rotate_team_codes`) som bara lagets tränare får köra.

**Frontend**
- `src/routes/auth.tsx` skrivs om till ett steg-för-steg-flöde: rollval → uppgifter → lag. Delade delar bryts ut till `src/components/auth/` så samma komponenter kan användas av `/onboarding` för konton som redan finns men saknar roll.
- `src/routes/_authenticated/onboarding.tsx` använder samma komponenter och samma kodflöde (tränarkod, spelarkod, skapa lag).
- `src/lib/teams.ts`: `findTeamByCode` returnerar även roll, ny `joinTeamWithCode`, `rotateTeamCode`; `requestJoin` behålls för bakåtkompatibilitet.
- Lagsidan (`team.$teamId.about.tsx` / `team.$teamId.leaders.tsx`): visa båda koderna, kopiera-knapp, skapa ny kod, samt lista väntande tränare tillsammans med väntande spelare.
- Startsidan: väntsida för spelare/föräldrar som ännu inte godkänts, med lagets namn.

**Tester**
- Enhetstester för kodtolkning (rätt roll för rätt kod, felaktig kod, redan medlem), åldersvalidering 18 år för tränare och 13 år för eget spelarkonto, samt att spelarkod aldrig ger tränarroll.
