# Instruktion 10G – Bedömning av framtida funktioner

Bedömning utan implementation. Skala 1–5 (nytta: 5 = högst, komplexitet: 5 = svårast, integritetsrisk: 5 = högst risk).

| Funktion | Problem som löses | Målgrupp | Nytta | Komplexitet | Integritetsrisk | Beroenden | Produktfas | Beslut | Motivering |
|---|---|---|---|---|---|---|---|---|---|
| Föräldrauppgifter (körning, kiosk, matchvärd, tvätt, material) | Ledare jagar volontärer via chatt | Tränare, vårdnadshavare | 4 | 3 | 2 | Vårdnadshavarkoppling (10C), kallelser, notiser i appen | Fas 3 | Bygg | Stor praktisk nytta i barnfotboll; kan byggas på event_invitations-mönstret utan ny arkitektur. |
| Export laguppställning som bild | Dela uppställningen i chatt/utskrift | Tränare, spelare, föräldrar | 4 | 2 | 2 | Laguppställning (10D), SVG→PNG-rasterisering | Fas 2 | Bygg | LineupPitch är redan SVG; rasterisera via canvas i klienten. Billig vinst. |
| Träningsplan som utskriftsvänlig PDF | Utskrift till plan, dela till ledarkollegor | Tränare | 4 | 2 | 1 | Befintlig PDF-export (jspdf) | Fas 2 | Bygg | Mönstret finns redan för taktik-PDF. |
| Export taktik som bild/GIF/MP4 | Dela anfallsmönster visuellt | Tränare | 3 | 2 | 1 | Redan implementerad exportdialog | Fas 2 | Bygg (färdigställ) | GIF/MP4-export finns delvis; komplettera med stillbild. |
| Skrivskyddade visningslänkar (matchplan, träningsplan, taktik) | Dela utan inlogg | Tränare, föräldrar, spelare | 4 | 3 | 3 | Delningsmönster från match_shares (10D), RLS-säkra RPC:er | Fas 2–3 | Bygg | Matchdelning finns nu; samma mönster kan återanvändas. Risk: exponera aldrig kontaktuppgifter/anteckningar. |
| Fullskärmsläge surfplatta/TV | Presentera taktik i omklädningsrummet | Tränare | 3 | 1 | 1 | Fullscreen API, befintlig presentationsvy | Fas 2 | Bygg | Ren frontend. |
| Installerbar PWA | Snabb åtkomst, appkänsla | Alla | 3 | 2 | 1 | Manifest + service worker | Fas 3 | Bygg | Låg risk; förbered för offline. |
| Offline-läsning av senast synkade träningar/matcher/taktiker | Dålig täckning på planen | Tränare | 4 | 4 | 2 | PWA, cachelagring, konflikthantering | Fas 3 | Bygg | Hög nytta på fotbollsplan; kräver genomtänkt cachestrategi (läsning först, skrivning senare). |
| Pushnotiser med verklig leverans + individuella inställningar | Svar på kallelser kommer in för sent | Tränare, vårdnadshavare | 4 | 4 | 3 | Push-prenumerationer, serverfunktion/bakgrundsjobb, notisinställningar per användare | Fas 3 | Bygg | Kräver riktig leveransinfrastruktur; appnotiser finns redan som grund. |
| Import seriematcher/motståndare/resultat/tabell | Slippa mata in serie manuellt | Tränare, klubbadmin | 3 | 4 | 2 | Extern datakälla (t.ex. SvFF/Fogis), mappning lag→lag | Fas 4 | Utred vidare | Beroende av extern tjänst/API-tillgång; utred datakälla och rättigheter först. |
| Enkel videoanalys (klipp, tema, spelare, pil på pausad bild, dela) | Återkoppla matchsituationer visuellt | Tränare, äldre spelargrupper | 3 | 5 | 5 | Lagring/streaming av video, ritlager, målgruppsdelning, samtycken | Fas 4+ | Utred vidare | Hög nytta men dyrast och mest integritetskänsligt: video på barn kräver samtycke, åtkomstkontroll och gallring. Bygg inte förrän policy finns. |
| Betalningssystem, medlemsavgifter, sponsorbutik, insamling | – | – | – | – | – | – | – | Avvisa (nuvarande fas) | Utanför produktens kärna; kan återupptas om klubbar efterfrågar. |
| Offentlig ranking av barn / MVP-omröstning 5–10 år | – | – | – | – | 5 | – | – | Avvisa | Strider mot barnanpassad pedagogik och integritetskrav. Byggs aldrig i nuvarande form. |
| 3D-taktiktavla | – | – | 2 | 5 | 1 | – | – | Avvisa | Hög kostnad, låg nytta mot befintlig 2D-tavla. |
| Avancerad liveanalys / AI-spelarspårning / automatiserad videoinspelning | – | – | 2 | 5 | 5 | Extern AI/videoinfrastruktur | – | Avvisa | Orimlig kostnad och integritetsrisk för barnverksamhet. |

## Rekommenderad byggordning

1. **Fas 2 (nära, billigt):** bildexport av laguppställning, träningsplan-PDF, taktik-bild, visningslänkar för träningsplan/taktik, fullskärmsläge.
2. **Fas 3:** föräldrauppgifter/volontärer, PWA, offline-läsning, pushnotiser.
3. **Fas 4 (utred först):** serieimport, videoanalys.

## Byggs utan större arkitekturändring
Bildexport, PDF, fullskärm, PWA-grund, visningslänkar (mönstret från matchdelning återanvänds), föräldrauppgifter (återanvänder kallelse-/rollmodellen).

## Kräver serverfunktion, bakgrundsjobb eller extern tjänst
Pushnotiser (leverans + schemaläggning), offline-synk (konflikthantering), serieimport (extern datakälla), videoanalys (videolagring, streaming, klippbearbetning).

## Särskilda barnrisker
- **Videoanalys:** filmade barn kräver vårdnadshavarsamtycke, strikta delningsbehörigheter, tidsbegränsad lagring och tydlig gallringspolicy.
- **Visningslänkar:** får aldrig exponera adresser, telefon, e-post, allergier eller interna anteckningar; delningslänkar ska alltid kunna återkallas.
- **Pushnotiser:** notiser till barn ska vara åldersanpassade och avställningsbara; inga budskap som skapar press eller ranking.
- Ranking/MVP avvisas helt.
