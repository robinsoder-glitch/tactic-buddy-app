# Översyn av Fotbollsrummet – förbättringsplan

Jag har gått igenom hela appen: menyn, alla 122 sidor, hur data hämtas och vad databasen faktiskt får för frågor. Nedan är vad jag hittade och vad jag föreslår, i prioritetsordning. Punkt 1–3 ger störst effekt för både tränare, spelare och föräldrar.

## Vad jag ser idag

- Appen har vuxit till väldigt många sidor (122 adresser). Flera gör nästan samma sak: `Kallelser`, `Mina kallelser` och `Kalender/kallelser`, en gammal `Bank`-sida som finns kvar parallellt med Träningsbank/Taktikbank/Kunskapsbank, och lagchatten finns både som egen sida och som flik inne på laget.
- Ingen sida förbereder sin data innan den visas. Varje gång man byter sida börjar hämtningen om från noll – därav blinkande laddningsrutor och "hoppande" innehåll.
- Appen frågar databasen mycket oftare än den behöver. Mätning på riktig trafik: din behörighet hämtas om och om igen (4 886 gånger), hela taktikbiblioteket inklusive alla ritningar laddas om (1 010 gånger) och hela kunskapsbanken med all artikeltext hämtas bara för att visa en lista (658 gånger). Chatt och notisprickar frågar dessutom av sig själva var 15–60:e sekund på varje sida.
- Några sidor har blivit väldigt stora och svåra att ändra i utan risk – framför allt taktikritaren och matchplaneringen.

## Föreslagna åtgärder

### 1. Snabbare och lugnare app (störst märkbar effekt)
- Låt hämtad information leva kvar en stund istället för att hämtas om vid varje sidbyte och varje gång man växlar flik i mobilen.
- Hämta din roll/behörighet en gång per inloggning istället för på varje sida.
- Hämta bara det som listan visar: titel, kategori och nivå – inte hela artikeltexten eller hela taktikritningen.
- Byt chattens ständiga frågande mot direktuppdatering, så nya meddelanden dyker upp direkt och trafiken samtidigt minskar.
- Förladda de vanligaste sidorna när man hovrar/trycker på menyn, så de känns omedelbara.

### 2. Rensa och förenkla strukturen
- Slå ihop dubblerade sidor: en enda kallelsesida, en enda ingång till banker/bibliotek, en enda lagchatt (gamla adresser leds vidare så inga länkar dör).
- Gör lagsidan till appens självklara nav: allt om ett lag (kalender, spelare, närvaro, chatt, statistik) samlat, istället för att samma sak nås från flera håll.
- Se över menyn: idag har tränare 8 huvudflikar + 5 i undermenyn. Förslag: 5 tydliga huvudflikar (Idag, Kalender, Lag, Planera, Kunskap) och resten under en meny.

### 3. Bättre startsida ("Idag")
- Startsidan blir en tydlig dagsvy anpassad efter vem du är: nästa aktivitet, obesvarade kallelser, det som saknas i planeringen, olästa meddelanden – med direktknappar. Idag är startsidan mest en lista med genvägar.

### 4. Tydligare upplevelse i vardagen
- Konsekventa lägen för laddning, tomt resultat och fel på alla listor (idag ser det olika ut på olika sidor).
- Genomgång av knapptexter och statusord så samma sak heter samma sak överallt.
- Mobilanpassning av de tunga sidorna: matchplanering och taktikritaren.
- Tillgänglighet: fortsatt genomgång av namn på kontroller, fokusordning och kontrast.

### 5. Underhållbarhet
- Dela upp de största sidorna i mindre delar (taktikritaren, matchplanering, meddelanden), så framtida ändringar går snabbare och med mindre risk.
- Samla dubblerad kod för kallelser/närvaro på ett ställe.

### 6. Uppföljning
- Mät om igen efter ändringarna (antal databasfrågor, laddtid) och kör hela testsviten.

## Teknisk sammanfattning

- `QueryClient` skapas utan defaults → `staleTime: 0` på 180 `useQuery`. Sätt globalt `staleTime` (t.ex. 60 s), `gcTime`, `refetchOnWindowFocus: false` och per-query undantag.
- Inga route-loaders finns (0 av 122 rutter). Inför `ensureQueryData` i loader + `useSuspenseQuery` för de tyngsta sidorna, och `defaultPreloadStaleTime` > 0 med `preload: "intent"`.
- `useAccount` hämtar `user_roles` per mount – flytta till en delad query med lång `staleTime` (rensas vid `SIGNED_IN`/`SIGNED_OUT`).
- Kolumnprojektion: `knowledge_articles` och `tb_tactics` hämtas med alla kolumner (inkl. `data`, `learn_sv`) för listvyer – välj kolumner explicit.
- Byt polling i `TeamChatPanel` (15 s) och `EventDiscussion` (20 s) mot Supabase Realtime; behåll polling som fallback. Slå ihop badge-hooksen (`useUnreadChat`, `useUnreadInbox`, `useOpenInvites`, `usePendingJoins`) till en RPC.
- Ruttkonsolidering: ta bort `/bank`, behåll redirects i `LEGACY_REDIRECTS`, slå ihop `tranarsnack` med `team.$teamId.tranarsnack`.
- Filsplit: `TacticEditor.tsx` (1910 rader), `planera-match.tsx` (1277), `meddelanden.tsx` (626).
- Efter varje steg: `bunx tsgo --noEmit`, `bunx vitest run`, ESLint.

## Upplägg

Jag föreslår att vi tar det i den ordning som står ovan, med avstämning efter varje punkt så du kan testa innan vi går vidare. Punkt 1 kan göras utan att något syns förändrat – bara snabbare.
