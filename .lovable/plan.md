# Kontaktformulär med mejl till er

## Mål
Spelare och vårdnadshavare ska kunna skicka frågor direkt i appen. Frågorna skickas som mejl till en mottagaradress ni själva läser (förvalt `info@fotbollsrummet.app`), så att ni kan svara via vanlig mejl.

## Det som byggs

### 1. Kontaktformulär i appen
- En ny kontaktsida/dialog med fälten **Ämne** och **Meddelande**. Avsändarens namn och e-post hämtas automatiskt från det inloggade kontot (ingen risk för felstavade svarsadresser).
- Åtkomlig på två ställen enligt val:
  - **Sidfoten** på appens sidor (länk "Kontakta oss").
  - **Inställningar** — ett kontaktkort för alla roller (spelare, vårdnadshavare, tränare).
- Tydlig bekräftelse efter utskick: "Ditt meddelande har skickats — vi svarar till din e-postadress."

### 2. Serverfunktion `sendContactMessage`
- Ny `createServerFn` (POST) med `requireSupabaseAuth` — endast inloggade användare kan skicka.
- Zod-validering: ämne och meddelande obligatoriska, rimliga maxlängder.
- Enkel hastighetsbegränsning per användare (t.ex. max 5 meddelanden/timme) så formuläret inte kan missbrukas för spam.
- Anropar den befintliga `sendTemplateEmail`-hjälpen med fast mall `contact-message` till mottagaradressen — mottagaren är aldrig valbar från klienten.
- Mottagaradressen styrs av en servermiljövariabel `CONTACT_RECIPIENT_EMAIL` (sparas som hemlighet, standardvärde `info@fotbollsrummet.app`). Enkel att byta senare utan kodändring.
- Idempotensnyckel per meddelande så omladdning inte dubblerar mejlen.

### 3. Mejlmall `contact-message`
- Ny React Email-mall i `src/lib/email-templates/` registrerad i `registry.ts`.
- Innehåll: avsändarens namn, e-post, roll/lag (om känt), ämne och meddelandetext.
- Tydlig instruktion i mejlet: "Svara direkt på användarens e-postadress ovan." (Mejl via Lovable saknar reply-to-stöd, därför lyfts avsändaradressen fram i brödtexten.)
- Avsändare: `Fotbollsrummet <noreply@fotbollsrummet.app>` (samma domän som kallelserna, notify.fotbollsrummet.app).

### 4. Tester och verifiering
- Vitest-tester för validering (tomma fält, för långa texter, hastighetstak).
- Playwright-kontroll: inloggad spelare skickar en fråga via sidfoten och via Inställningar; bekräftelse visas; tränar-/spelarvyer påverkas inte.
- `bunx vitest run` grönt.

## Viktigt att veta om mottagaradressen
- Lovable hanterar bara **utgående** mejl. För att `info@fotbollsrummet.app` ska kunna **ta emot** era svar behövs en mejllåda för domänen (t.ex. Google Workspace eller annan mejlvärd) med MX-pekare. Det ingår inte i denna plan.
- Alternativ: ange er befintliga privata adress som `CONTACT_RECIPIENT_EMAIL` — då fungerar allt direkt utan ny mejllåda. Jag frågar om detta vid genomförandet.
- Mejlutskicken startar när domänen notify.fotbollsrummet.app har verifierats (pågår, kan ta upp till 72 timmar).

## Berörda filer (tekniskt)
- Ny: `src/lib/email-templates/contact-message.tsx`, `src/lib/contact.functions.ts`, kontakt-komponent/sida.
- Ändrad: `src/lib/email-templates/registry.ts`, `src/routes/_authenticated/installningar.tsx`, sidfotskomponenten.
- Hemlighet: `CONTACT_RECIPIENT_EMAIL` via add_secret.
