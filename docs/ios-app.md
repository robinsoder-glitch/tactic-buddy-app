# Fotbollsrummet för iPhone

Detta projekt innehåller en färdig iOS-app byggd med [Capacitor](https://capacitorjs.com). Appen visar samma Fotbollsrummet som webbsidan, men i helskärm utan webbläsarfält.

## Vad som är förberett

- `capacitor.config.ts` – app-id `se.fotbollsrummet.app`, pekar mot den publicerade sajten.
- `ios/` – komplett Xcode-projekt med ikon, startskärm och deep link-schema (`fotbollsrummet://`).
- Google-inloggningen öppnas i systemens webbläsare och kommer tillbaka till appen via deep link.
- Layouten anpassar sig efter iPhone-skärmens "safe area" (Dynamic Island, notch, svepgester).
- Dark/light-läge följer telefonens systeminställning.

## Så här bygger och publicerar du appen

### 1. Förbered ett Apple-konto

- Skaffa [Apple Developer Program](https://developer.apple.com/programs), 99 USD/år.
- Logga in på [App Store Connect](https://appstoreconnect.apple.com) och skapa en ny app med **Bundle ID** exakt: `se.fotbollsrummet.app`.

### 2. Öppna projektet på en Mac

```bash
cd ios/App
open App.xcworkspace
```

Om du inte har Xcode lokalt kan du ladda upp `ios/`-mappen till en tjänst som Macincloud eller be någon med Mac köra nästa steg.

### 3. Bygg och kör på en riktig telefon

- Välj ditt team under **Signing & Capabilities**.
- Anslut en iPhone och trygg **Run**.
- Testa inloggning, kalender och att navigera mellan sidorna.

### 4. Skicka in till App Store

- Välj **Product → Archive**.
- Välj **Distribute App → App Store Connect**.
- Fyll i:
  - App-namn: "Fotbollsrummet"
  - Undertitel: "Planera träningar och matcher"
  - Beskrivning: "Fotbollsrummet hjälper tränare och lag att planera träningar, matcher, kallelser och taktik – allt på ett ställe."
  - Integritetspolicy: du behöver en URL. Skapa en enkel sida i Lovable-projektet under `/integritetspolicy` eller använd en befintlig policyhost.
  - Skärmbilder för 6,5" och 5,5" iPhone.

### 5. Uppdateringar efter publicering

När du ändrar innehåll i Lovable behöver du inte skicka in appen igen – den hämtar alltid den senaste publicerade webbversionen. Du behöver bara göra en ny inlämning om du ändrar själva appens grund (t.ex. ikon, app-id, eller inloggningsflödet).

## Viktiga inställningar i Supabase/Lovable Cloud

Innan appen används på riktigt måste du lägga till deep link-adressen bland tillåtna redirect-URL:er:

1. Gå till backend-/auth-inställningar i Lovable Cloud.
2. Lägg till `fotbollsrummet://auth` under **Redirect URLs**.
3. Se till att `https://tactic-buddy-app.lovable.app/auth` också finns kvar för webben.

## Tekniska detaljer

- `server.url` i `capacitor.config.ts` pekar mot publicerade URL:en.
- OAuth öppnas via `@capacitor/browser`.
- Deep links hanteras via `@capacitor/app` och URL-schemat `fotbollsrummet`.
- Statusfältet får samma mörkgröna färg som appen (`#0b3d24`).
- Service worker är avstängd i appen; offlinestöd ingår inte i den här versionen.
