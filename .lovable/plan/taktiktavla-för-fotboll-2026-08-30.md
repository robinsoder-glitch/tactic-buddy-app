# Taktiktavla för fotboll

En mobil-först taktikapp där du placerar spelare på planen, bygger animationer i steg (keyframes) och håller en spelarbank med namn och bilder. Allt sparas i molnet bakom inloggning.

## Huvudflöden

**1. Inloggning**
E-post + lösenord via Lovable Cloud. Alla taktiker och spelare är privata per användare.

**2. Spelarbank**
- Lägg till spelare: namn, tröjnummer, lagfärg (hemma/borta), foto (uppladdning eller ta kort på mobilen).
- Rutnät med spelarkort, sök och redigera/ta bort.
- Utan foto visas initialer + nummer i en färgad bricka.

**3. Taktiktavlan**
- Planval: hel 11-mannaplan eller liten 5/7-mannaplan, liggande läge på mobil/surfplatta.
- Dra in spelare från banken till planen med touch; dra runt för att positionera.
- Boll som eget objekt.
- Rita statiska pilar/linjer (löpning = heldragen, passning = streckad) och radera dem.
- Snabbverktyg: spegelvänd, rensa plan, ångra.

**4. Animation med steg (keyframes)**
- Tidslinje längst ned med steg: Steg 1, Steg 2, Steg 3 ...
- Du flyttar spelare och boll till önskade positioner i varje steg; appen sparar positionerna för det steget.
- "Lägg till steg" duplicerar nuvarande läge som utgångspunkt.
- Play spelar upp hela sekvensen med mjuk interpolation mellan stegen; paus, hoppa till steg, hastighet (0.5x/1x/2x), loop.
- Steg kan döpas ("Uppspel", "Djupledslöpning") och tas bort/ordnas om.

**5. Mina taktiker**
Startsidan listar sparade taktiker med namn, plantyp och antal steg. Öppna, döp om, duplicera, ta bort.

## Teknisk plan

- **Rendering:** SVG-baserad plan med normaliserade koordinater (0–1) så den skalar över alla skärmar. Pointer events för drag (fungerar för både touch och mus).
- **Animation:** requestAnimationFrame som interpolerar mellan keyframe-positioner (easing in/out), inte CSS-transitions, så scrubbing i tidslinjen fungerar.
- **Datamodell (Lovable Cloud):**
  - `profiles` – användarprofil.
  - `players` – user_id, namn, nummer, färg, photo_url.
  - `tactics` – user_id, namn, plantyp (full/small), skapad/uppdaterad.
  - `tactic_frames` – tactic_id, ordning, namn, `objects` JSONB (spelare/boll-positioner), `drawings` JSONB (pilar/linjer).
  - RLS: allt scopat till `auth.uid()`, med grants för `authenticated`.
- **Bilder:** privat storage-bucket `player-photos` med per-användare-mapp och RLS-policies.
- **Routing:** `/` = mina taktiker (inloggad) / landningsvy, `/auth`, `/bank`, `/tactic/$id` under skyddad layout.
- **Sparning:** autosave med debounce vid ändringar samt manuell "Spara".

## Ordning

1. Aktivera Lovable Cloud, auth-flöde och skyddade routes.
2. Databas + storage med RLS.
3. Spelarbank (CRUD + bilduppladdning).
4. Planvy med drag & drop och ritverktyg.
5. Keyframe-tidslinje och uppspelning.
6. Taktiklista, autosave och mobilputs.
