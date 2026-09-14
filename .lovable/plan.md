# Fotbollsrummet som iPhone-app i App Store

Målet är en riktig app som går att installera från App Store. Appen visar samma Fotbollsrummet som idag och kräver internet – ingen offline-funktion byggs.

## Så fungerar upplägget

Appen blir ett riktigt iOS-projekt (Capacitor) som visar den publicerade sajten i helskärm, utan webbläsarfält. Det betyder:

- En app-ikon på hemskärmen och i App Store.
- Alla framtida ändringar du gör här syns direkt i appen – ingen ny inlämning till Apple behövs för vanliga uppdateringar.
- Inloggning, kalender, kallelser och taktiktavlan fungerar precis som idag.

## Vad jag gör i projektet

1. Lägger in iOS-appens grund: appnamn "Fotbollsrummet", app-id, och att appen öppnar den publicerade adressen.
2. Skapar app-ikon och startskärm i alla storlekar Apple kräver, i lagets färger (samma gröna ton som idag).
3. Anpassar appen för iPhone-skärmen: rätt utrymme för toppkant/"lucka" och nedre svepfältet, ingen studs-scroll vid sidkanterna, mörkt/ljust läge följer telefonen.
4. Ser till att Google-inloggningen fungerar inuti appen (öppnas i ett säkert systemfönster och kommer tillbaka till appen).
5. Skriver en kort svensk steg-för-steg-guide: hur du bygger och skickar in appen till App Store.

## Det du behöver göra själv

Apple tillåter bara inlämning från deras egna verktyg, så den sista biten kan jag inte göra åt dig:

- Apple Developer-konto, 99 USD/år.
- En Mac med Xcode (eller någon som har det).
- Ladda ner projektet, öppna iOS-mappen i Xcode, tryck bygg och skicka in.
- Fylla i App Store-texter, skärmbilder och integritetspolicy (jag förbereder förslag på texterna).
- Apples granskning tar oftast 1–3 dagar. Appar som bara visar en webbsida kan nekas – därför bygger vi in app-typiska delar (ikon, startskärm, helskärm, systeminloggning) för att minska risken.

## Teknisk sammanfattning

- Capacitor 7 med `@capacitor/ios`, konfiguration i `capacitor.config.ts` (`appId: se.fotbollsrummet.app`, `server.url` mot den publicerade adressen, `server.cleartext: false`).
- Genererat `ios/`-projekt checkas in i repot; ikoner och splash under `ios/App/App/Assets.xcassets`.
- `@capacitor/browser` för OAuth-flödet; Supabase redirect-URL kompletteras med appens custom scheme och en deep link-hanterare.
- `@capacitor/status-bar` och `@capacitor/splash-screen` för utseende vid start.
- CSS: `viewport-fit=cover` plus `env(safe-area-inset-*)` i layoutens ytterkanter; `overscroll-behavior: none`.
- Inget service worker-arbete och ingen offline-cache (befintlig `sw.js`-städning lämnas orörd).
- Dokumentation i `docs/ios-app.md`.
