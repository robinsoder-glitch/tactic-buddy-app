import { describe, expect, it } from "vitest";
import { isYoungPlayer, statFieldsForAge } from "./player-stats";

describe("statistik efter ålder", () => {
  it("spelare under 12 år får bara matcher", () => {
    expect(statFieldsForAge(8)).toEqual(["matches"]);
    expect(statFieldsForAge(11)).toEqual(["matches"]);
  });

  it("från 12 år visas mål, assist, kort och poäng", () => {
    expect(statFieldsForAge(12)).toContain("goals");
    expect(statFieldsForAge(15)).toEqual([
      "matches",
      "goals",
      "assists",
      "yellow_cards",
      "red_cards",
      "points",
    ]);
  });

  it("okänd ålder behandlas som yngre spelare", () => {
    expect(isYoungPlayer(null)).toBe(true);
    expect(statFieldsForAge(null)).toEqual(["matches"]);
  });
});
