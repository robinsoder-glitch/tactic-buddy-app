# Enklare inbjudningar och tydligare språk

Idag finns två parallella sätt att få in familjer i laget (lagkod och personlig länk), två kontotyper för barnet (spelarkonto och vårdnadshavarkonto) och en varning om "inget spelarkonto kopplat" som visas även i lag där barn inte ska ha konto. Det gör starten krånglig. Planen förenklar till ett spår.

## 1. Ett spår: vårdnadshavare i yngre lag

- Ett lag räknas som **yngre lag** när åldersgruppen motsvarar spelare under 12 år (t.ex. P2015, F2016). Tränaren ser vilket läge laget har på lagets översikt och kan justera det där om årtalet är otydligt.
- I yngre lag finns **bara vårdnadshavarkonton**. Rutan "Spelarens eget konto" och varningen "Inget spelarkonto är kopplat" visas inte alls.
- I yngre lag visas i stället en enda röd varning per barn: "Ingen vårdnadshavare är kopplad — barnet får inga kallelser."
- I lag från 12 år och uppåt fungerar det som idag: både spelarkonto och vårdnadshavare kan kopplas, med båda varningarna.
- Lagkoden i yngre lag heter och beter sig som en **familjekod**: den som går med anger sitt eget namn och barnets namn, och blir alltid vårdnadshavare.

## 2. Guidad start när laget skapas

Efter att laget skapats möts tränaren av tre steg (går att hoppa över och återuppta senare):

```text
Steg 1  Lägg in truppen      namn + ev. tröjnummer + födelseår, en rad i taget
Steg 2  Dela inbjudan        en länk/kod till alla familjer, kopiera eller dela
Steg 3  Godkänn              lista över ansökningar, koppla varje till rätt barn
```

Steg 3 finns kvar som en påminnelse på lagsidan så länge någon ansökan är obehandlad.

## 3. En inbjudan istället för många

- **Huvudvägen:** en gemensam länk för laget (`/inbjudan/<kod>`) som tränaren delar i lagchatt, SMS eller mejl. Den som klickar ser lagets namn, skapar konto (eller loggar in) och anger barnets namn. Ansökan hamnar hos tränaren som godkänner och kopplar till rätt spelare i truppen.
- Den som inte har konto leds direkt in i kontoskapandet med laget förifyllt — inget extra kodinmatande.
- Personliga länkar per barn tas bort som förstaval i truppen; funktionen finns kvar för ledarinbjudningar.
- Tränarkoden för att bjuda in andra ledare lämnas orörd.

## 4. Enhetliga ord

Rättas genomgående:

| Idag | Blir |
| --- | --- |
| "Ledare" på ett ställe, "Tränare" på ett annat, för samma roll | **Tränare** som roll; **Ledare** bara om den som är ansvarig för en viss aktivitet |
| Adressen `/ovningsbank` men rubriken "Träningsbank" | **Träningsbank** överallt, gamla adressen leder vidare |
| "Samling" betyder både övningsmapp och samlingstid | **Samling** = samlingstid; övningsmappar heter **Övningssamling** |
| "Träning"/"Träningspass" blandas | **Träning** = aktiviteten i kalendern, **Träningspass** = det planerade innehållet |
| "Förälder" i lösa texter | **Vårdnadshavare** |

## 5. Färre saker på skärmen

- Truppens spelarkort visar en enda tydlig statusrad: *Kopplad familj* / *Inbjudan skickad* / *Ingen familj kopplad* (röd).
- Kopplingsrutorna slås ihop till ett kort "Familj och konton" istället för två separata rutor.

## Teknisk sammanfattning

- Ny hjälpmodul `src/lib/team-age.ts`: `isYouthTeam(team)` utifrån `teams.age_group` (årtalsparsning mot innevarande säsong) med möjlighet till manuell override i `teams`. Ny kolumn `teams.guardian_only boolean` (nullable = härled från ålder) via migration.
- `PlayerAccountLink` renderas bara när `!guardianOnly`; `GuardianLinks` får skärpt varningstext i guardian-only-läge.
- `join_team_with_code` / `accept_team_invite`: i guardian-only-lag tvingas `member_role = 'guardian'` oavsett inskickad `account_kind`; `profiles.guardian_for_name` krävs.
- Guidad start: ny route `/team/$teamId/kom-igang` med tre steg, länkad från `createTeam`-success i `CoachStart.tsx` och från lagöversikten tills truppen har minst en spelare.
- Inbjudningslänk: `inviteLink()` får en lagvariant byggd på `teams.join_code`; `preview_team_invite` utökas för kodbaserade länkar. `addTeamInvite` med `target_player_id` behålls för ledare.
- Terminologi: `permissions.ts:11` `coach: "Ledare"` → `"Tränare"`; `CollectionButton`/`collections.ts`-texter till "övningssamling"; route-mapp `ovningsbank.*` → `traningsbank.*` med redirect i `LEGACY_REDIRECTS`.
- Efter varje steg: `bunx tsgo --noEmit`, `bunx vitest run`, ESLint. Nya tester för `isYouthTeam`, guardian-only-rendering och rollpåtvingning.
