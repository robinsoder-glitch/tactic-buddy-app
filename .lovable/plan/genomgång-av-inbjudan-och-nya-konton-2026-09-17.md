# Genomgång av inbjudan och nya konton

Först testar jag hela flödet skarpt i appen, sedan rättar jag det som gör flödet svårt att förstå.

## Del 1 – Testa nuvarande flöde

Jag går igenom fyra vägar från början till slut, med riktiga testkonton som raderas efteråt:

1. Tränare skapar konto utan kod, skapar lag, hamnar i guidade starten.
2. Vårdnadshavare klickar på lagets länk utan konto, skapar konto, skriver barnets namn, ansöker.
3. Vårdnadshavare som redan har konto klickar på samma länk.
4. Ny tränare går med via tränarkod.

För varje väg noterar jag vad användaren ser, vad som är oklart och vad som går fel.

## Del 2 – Det jag redan ser i dagens flöde

- **Länken berättar inte vilket lag det gäller.** Innan man loggar in står bara "Inbjudan till laget" – inget lagnamn, ingen klubb, ingen ålder. Det ser ut som skräppost.
- **Samma sak frågas två gånger.** Vid registreringen väljer familjen "Jag är spelaren / Jag är vårdnadshavare" och skriver barnets namn; inbjudningssidan frågar om barnets namn igen i vissa fall.
- **Rollvalet borde vara låst i yngre lag.** Kommer man via länken till ett lag med bara vårdnadshavarkonton får man ändå välja "Jag är spelaren", trots att systemet alltid gör en till vårdnadshavare.
- **Tre namn på samma sak.** "Spelarkod" vid registrering, "Lagkod" hos tränaren, "inbjudningslänk" i delningen.
- **Ingen tydlig väntesida.** Efter ansökan skickas familjen rakt in på lagsidan, där det mesta är tomt tills tränaren godkänt. Ingen förklarar vad som händer nu.
- **Två parallella vägar in** (personlig engångslänk och lagets gemensamma länk) syns samtidigt och gör bilden rörig.

## Del 3 – Föreslagna förbättringar

1. **Inbjudningssidan visar laget direkt**, redan innan inloggning: lagnamn, klubb och åldersgrupp, plus en kort rad om vad som händer efter att man gått med.
2. **En fråga, en gång.** Kommer man via länken frågas barnets namn bara på ett ställe, och lagkoden fylls i och låses.
3. **Yngre lag: bara vårdnadshavare.** Rollvalet göms och det står i klartext "Du skapar kontot som vårdnadshavare – barnet kopplas till dig".
4. **Enhetliga ord:** "lagkod" och "tränarkod" överallt; "inbjudningslänk" bara om själva länken.
5. **Tydlig väntesida** efter ansökan: "Din ansökan är skickad till [Lag]. Tränaren godkänner dig – du får en notis." Med det lilla man kan se under tiden.
6. **Tränarsidan visar vem som väntar** och påminner om att dela länken igen när ingen ansökt.

## Teknisk del

- Test med Playwright mot dev-servern; testkonton och testlag raderas efteråt.
- `inbjudan.$token.tsx`: publik lagförhandsvisning via en publik serverfunktion eller en `anon`-läsbar RPC (`find_team_by_code` kräver i dag inloggning), gemensam vy för inloggad/utloggad, ny status-/väntesektion.
- `AccountSetupFields.tsx`: låst roll och dold rollväxlare när koden hör till ett `guardian_only`-lag (`find_team_by_code` returnerar redan `guardian_only`), enhetliga etiketter.
- `auth.tsx`: barnets namn frågas en gång och skickas vidare till anslutningen, så inbjudningssidan inte frågar igen.
- `team.$teamId.kom-igang.tsx` / `about.tsx`: väntande ansökningar och påminnelse om att dela länken.
- Nya rena hjälpfunktioner med tester i `src/lib/invite-links.ts` respektive `src/lib/account-setup.ts`.
