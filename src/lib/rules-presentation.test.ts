import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { buildRulesPresentation, formatLabelFor, MISSING_TEXT } from "./rules-presentation";
import { RulesView } from "@/components/rules/RulesView";

const ruleset = {
  id: "svff_5v5_2025_26",
  format: "5v5",
  season: "2025/26",
  data: {
    id: "svff_5v5_2025_26",
    format: "5v5",
    season: "2025/26",
    ageRange: { min: 8, max: 9 },
    players: { outfield: 4, goalkeepers: 1, substitutions: "Fria byten" },
    pitch: { lengthM: { min: 30, max: 30 }, widthM: { min: 15, max: 20 }, penaltyAreaMarked: false },
    goal: { widthM: 3, heightM: 1.5 },
    matchDurations: [{ context: "sammandrag", periods: 3, minutesPerPeriod: 10 }],
    goalkeeperPuntAllowed: false,
    goalkeeperBackpassHandsAllowed: true,
    retreatLine: { enabled: true, position: "mittlinjen", quickRestartAllowed: true },
    setPieces: { freeKicks: "Alla frisparkar är indirekta.", corner: "Indirekt hörna." },
    fourGoalRule: "Vid underläge med fyra mål får laget spela med fem utespelare.",
    sources: [
      {
        title: "SvFF: Nationella spelformer 5 mot 5",
        url: "https://example.org/5mot5.pdf",
        reviewedAt: "2026-08-30",
        sourceType: "official_rule",
        licenseStatus: "link-and-paraphrase",
      },
    ],
  },
};

const verifiedDistrict = {
  id: "uppland_5v5_2026",
  name: "Upplands FF – 5 mot 5",
  data: {
    inheritsRuleset: "svff_5v5_2025_26",
    verificationStatus: "verified",
    season: "2026",
    overrides: { pitch: { lengthM: 30, widthM: 20 }, generalOverageDispensation: 2 },
    competitionNotes: ["Mittlinjen fungerar som retreatlinje."],
    sources: [{ title: "Upplands FF", url: "https://example.org/uppland.pdf", reviewedAt: "2026-08-30" }],
  },
};

const unverifiedDistrict = {
  id: "district_template_5v5",
  name: "Mall för nytt distrikt",
  data: {
    inheritsRuleset: "svff_5v5_2025_26",
    verificationStatus: "needs-verification",
    overrides: { competitionFormat: "Hemlig serie" },
    competitionNotes: [],
    sources: [],
  },
};

function render(props: Parameters<typeof RulesView>[0]) {
  return renderToStaticMarkup(createElement(RulesView, props));
}

describe("buildRulesPresentation", () => {
  it("översätter spelform till svenska", () => {
    expect(formatLabelFor("5v5")).toBe("5 mot 5");
    expect(buildRulesPresentation(ruleset).formatLabel).toBe("5 mot 5");
  });

  it("visar statusen Verifierad när allt finns", () => {
    const view = buildRulesPresentation(ruleset, [verifiedDistrict]);
    expect(view.status).toBe("Verifierad");
    expect(view.source?.url).toBe("https://example.org/5mot5.pdf");
  });

  it("markerar saknade uppgifter i stället för tomma värden", () => {
    const view = buildRulesPresentation({ ...ruleset, data: { sources: ruleset.data.sources } });
    expect(view.status).toBe("Behöver kontrolleras");
    expect(view.sections.every((s) => s.value.length > 0)).toBe(true);
    expect(view.sections.filter((s) => s.missing).length).toBeGreaterThan(0);
    expect(view.sections.find((s) => s.missing)?.value).toBe(MISSING_TEXT);
  });

  it("markerar ej verifierade distrikt som endast admin", () => {
    const view = buildRulesPresentation(ruleset, [verifiedDistrict, unverifiedDistrict]);
    expect(view.districts.find((d) => d.id === "district_template_5v5")?.adminOnly).toBe(true);
    expect(view.districts.find((d) => d.id === "uppland_5v5_2026")?.adminOnly).toBe(false);
  });
});

describe("RulesView", () => {
  const html = render({ rulesets: [ruleset], districts: [verifiedDistrict, unverifiedDistrict] });

  it("visar inga råa objektnycklar eller rå JSON", () => {
    for (const key of [
      "sourceType",
      "licenseStatus",
      "inheritsRuleset",
      "overrides",
      "goalWidthM",
      "widthM",
      "players outfield",
      "verificationStatus",
      "svff_5v5_2025_26",
      "{&quot;",
    ]) {
      expect(html).not.toContain(key);
    }
  });

  it("visar aldrig undefined eller null", () => {
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
    expect(html).not.toContain("[object Object]");
  });

  it("döljer ej verifierade distriktsregler för vanliga användare", () => {
    expect(html).not.toContain("Mall för nytt distrikt");
    const adminHtml = render({
      rulesets: [ruleset],
      districts: [verifiedDistrict, unverifiedDistrict],
      isAdmin: true,
    });
    expect(adminHtml).toContain("Mall för nytt distrikt");
    expect(adminHtml).toContain(
      "Den här distriktsuppgiften är inte verifierad och får inte användas som gällande regel.",
    );
  });

  it("visar rätt svensk statustext", () => {
    expect(html).toContain("Verifierad");
    const partial = render({ rulesets: [{ ...ruleset, data: { sources: ruleset.data.sources } }], districts: [] });
    expect(partial).toContain("Behöver kontrolleras");
  });

  it("visar källänken när en källa finns", () => {
    expect(html).toContain("Öppna källa");
    expect(html).toContain("https://example.org/5mot5.pdf");
  });

  it("fungerar när regelvärden saknas", () => {
    const partial = render({ rulesets: [{ id: "x", format: "7v7", season: null, data: {} }], districts: [] });
    expect(partial).toContain("Uppgiften saknas och behöver kontrolleras.");
    expect(partial).not.toContain("undefined");
  });

  it("visar den nationella regeln före distriktsavvikelsen", () => {
    const national = html.indexOf("Antal spelare");
    const district = html.indexOf("Upplands FF");
    expect(national).toBeGreaterThan(-1);
    expect(district).toBeGreaterThan(national);
  });
});
