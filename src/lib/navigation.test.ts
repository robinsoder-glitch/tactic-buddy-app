import { describe, expect, it } from "vitest";
import {
  MAIN_TABS,
  SECONDARY_TABS,
  PLANNING_TABS,
  LEGACY_REDIRECTS,
  isTabActive,
  parentPathFor,
} from "./navigation";
import {
  selectionLabel,
  plannedLabel,
  sumMinutes,
  toggleSelection,
  upcomingOfType,
} from "./planning";

describe("huvudmenyn", () => {
  it("visar de primära arbetsområdena i rätt ordning", () => {
    expect(MAIN_TABS.map((tab) => tab.label)).toEqual([
      "Idag",
      "Kalender",
      "Kallelser",
      "Planera",
      "Lag",
    ]);
  });

  it("samlar planeringssidorna under Planera", () => {
    expect(PLANNING_TABS.map((tab) => tab.label)).toEqual([
      "Planera träning",
      "Matcher",
      "Närvaro",
      "Spelare",
      "Träningsbank",
      "Taktik",
    ]);
    expect(parentPathFor("/planera-match")).toBe("/planera");
  });

  it("samlar lag och verktyg i en sekundär meny", () => {
    expect(SECONDARY_TABS.map((tab) => tab.label)).toEqual([
      "Kunskap",
      "Meddelanden",
      "Tränarsnack",
      "Inställningar",
    ]);
  });

  it("markerar aktiv flik", () => {
    const planera = MAIN_TABS.find((tab) => tab.to === "/planera")!;
    expect(isTabActive("/planera", planera)).toBe(true);
    expect(isTabActive("/kunskapsbank", planera)).toBe(false);
    const idag = MAIN_TABS.find((tab) => tab.to === "/")!;
    expect(isTabActive("/kalender", idag)).toBe(false);
  });

  it("ger varje detaljsida en definierad föräldervy", () => {
    expect(parentPathFor("/kunskapsbank/teknik")).toBe("/kunskapsbank");
    expect(parentPathFor("/team/abc")).toBe("/teams");
    expect(parentPathFor("/planera")).toBeNull();
  });

  it("leder gamla adresser till rätt ny sida", () => {
    expect(LEGACY_REDIRECTS["/skapa"]).toBeUndefined();
    expect(LEGACY_REDIRECTS["/taktikbank"]).toBeUndefined();
    expect(LEGACY_REDIRECTS["/mina-kallelser"]).toBe("/kallelser");
  });

  it("har inga dubbla länkar till samma sida", () => {
    const all = [...MAIN_TABS, ...SECONDARY_TABS, ...PLANNING_TABS].map((tab) => tab.to);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe("planering", () => {
  const events = [
    {
      id: "1",
      team_id: "t",
      type: "training" as const,
      title: null,
      starts_at: "",
      location: null,
      team_name: null,
    },
    {
      id: "2",
      team_id: "t",
      type: "match" as const,
      title: null,
      starts_at: "",
      location: null,
      team_name: null,
    },
  ];

  it("delar upp kalendern i träningar och matcher", () => {
    expect(upcomingOfType(events, "training").map((e) => e.id)).toEqual(["1"]);
    expect(upcomingOfType(events, "match").map((e) => e.id)).toEqual(["2"]);
  });

  it("markerar och avmarkerar spelare i uttagningen", () => {
    expect(toggleSelection([], "a")).toEqual(["a"]);
    expect(toggleSelection(["a", "b"], "a")).toEqual(["b"]);
  });

  it("visar antal valda spelare", () => {
    expect(selectionLabel(3)).toBe("Valda spelare: 3");
  });

  it("visar om aktiviteten redan har innehåll", () => {
    expect(plannedLabel(0)).toBe("Ingen planering ännu");
    expect(plannedLabel(2)).toBe("Planerat innehåll: 2 delar");
  });

  it("summerar planerad tid", () => {
    expect(sumMinutes([{ minutes: 15 }, { minutes: null }, { minutes: 20 }])).toBe(35);
  });
});
