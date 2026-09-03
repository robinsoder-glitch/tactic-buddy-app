# Städa upp toppmenyn

Problemet i skärmbilden: alla tio flikar ligger som fullbreda knappar i samma rad, så raden bryts i tre våningar. Ögat hittar inget mönster och menyn tar en tredjedel av skärmen.

## Förslag (det jag vill bygga)

1. **En enda rad, aldrig radbrytning.** Logotyp till vänster, arbetsflikar i mitten, verktyg till höger. Menyn får fast höjd (56 px) oavsett fönsterbredd.
2. **Färre synliga val.** Bara de fem arbetsområdena syns som text: Planera träning, Planera match, Taktik, Träningsbank, Kunskap.
3. **Verktygen samlas i en knapp.** Kalender, Närvaro, Tränarsnack, Mina lag, Inställningar (och Admin) flyttas in i en enda meny till höger, "Lag och verktyg", som fälls ut. Röda notisprickar (olästa meddelanden, nya ansökningar) summeras på själva knappen så inget missas.
4. **Lugnare utseende.** Ikoner bara i utfällda menyn, inte på textflikarna – det är ikonerna plus text plus rundade rutor som gör raden plottrig i dag. Aktiv flik markeras med en tunn understrykning i klubbgrönt i stället för en fylld grön knapp.
5. **Smala fönster.** Mellan surfplatta och dator blir arbetsflikarna en sidscrollande rad i stället för att radbrytas. Mobilens bottenmeny lämnas orörd.

## Teknisk sammanfattning

- `src/components/AppNav.tsx`: skriv om desktopdelen – `flex-nowrap`, `h-14`, primärflikar utan ikon med `border-b-2` som aktivmarkering, sekundärflikarna och Admin flyttas in i en befintligmönstrad popover (samma öppna/stäng-logik som mobilmenyn redan använder: pointerdown utanför + Escape).
- Notisbadgar: `useUnreadChat` + `usePendingJoins` summeras till en badge på verktygsknappen, och visas dessutom vid respektive rad i utfällningen.
- `src/lib/navigation.ts` behåller samma flikdata; ingen routing eller behörighet ändras.
- Rollstyrningen via `tabsForRole` fungerar som i dag – spelare/vårdnadshavare får sina tre flikar plus verktygsknappen.
