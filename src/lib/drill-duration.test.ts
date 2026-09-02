import { describe, expect, it } from "vitest";
import type { Drill } from "./taktikbank";
import { drillDefaultMinutes, drillDurationLabel } from "./drill-duration";
import { knowledgeLevels } from "./knowledge";
import type { KnowledgeArticle } from "./knowledge";

function drill(data: Record<string, unknown>): Drill {
  return { id: "d", title: "T", default_minutes: 8, purpose: null, data: { id: "d", title: "T", ...data } } as Drill;
}

describe("övningens längd", () => {
  it("visar 10–20 min som standard", () => {
    expect(drillDurationLabel(drill({}))).toBe("10–20 min");
  });

  it("använder intervallet från övningen", () => {
    expect(drillDurationLabel(drill({ durationMin: 15, durationMax: 25 }))).toBe("15–25 min");
  });

  it("föreslår 15 min inom intervallet", () => {
    expect(drillDefaultMinutes(drill({}))).toBe(15);
    expect(drillDefaultMinutes(drill({ durationMin: 5, durationMax: 10 }))).toBe(10);
  });
});

describe("kunskapsnivåer", () => {
  it("sorteras Grund, Fortsättning, Fördjupning", () => {
    const articles = [
      { level: "Fördjupning" },
      { level: "Grund" },
      { level: "Fortsättning" },
    ] as KnowledgeArticle[];
    expect(knowledgeLevels(articles)).toEqual(["Grund", "Fortsättning", "Fördjupning"]);
  });
});
