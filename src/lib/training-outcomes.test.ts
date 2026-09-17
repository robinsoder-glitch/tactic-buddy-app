import { describe, expect, it } from "vitest";
import { focusAreasWithLegacy, guideHasContent, lines, toggleFocus } from "./training-outcomes";

describe("resultatbaserad träningsplanering", () => {
  it("väljer flera fokusområden och kan avmarkera ett", () => {
    const selected = toggleFocus(toggleFocus([], "Passningar och mottagning"), "Avslut");
    expect(selected).toEqual(["Passningar och mottagning", "Avslut"]);
    expect(toggleFocus(selected, "Avslut")).toEqual(["Passningar och mottagning"]);
  });

  it("mappar äldre tema till ett nytt fokusområde", () => {
    expect(focusAreasWithLegacy([], "Passning")).toEqual(["Passningar och mottagning"]);
    expect(focusAreasWithLegacy([], "Eget äldre tema")).toEqual(["Eget äldre tema"]);
  });

  it("delar flerradstext till guidepunkter och känner igen innehåll", () => {
    expect(lines("Först\nSedan; Till sist")).toEqual(["Först", "Sedan", "Till sist"]);
    expect(guideHasContent({ execution: ["Spela"] })).toBe(true);
    expect(guideHasContent({})).toBe(false);
  });
});