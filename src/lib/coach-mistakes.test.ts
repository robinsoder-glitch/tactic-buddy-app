import { describe, expect, it } from "vitest";
import { COACH_MISTAKES, MISTAKE_SOURCES, mistakesByRank } from "./coach-mistakes";

describe("vanliga tränarmisstag", () => {
  it("har exakt tio punkter med obruten och unik rank 1–10", () => {
    const ranks = COACH_MISTAKES.map((item) => item.rank);
    expect(ranks).toHaveLength(10);
    expect(new Set(ranks).size).toBe(10);
    expect(mistakesByRank().map((item) => item.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("saknar tomma textfält", () => {
    for (const item of COACH_MISTAKES) {
      for (const field of [item.title, item.whatItIs, item.whyItMatters, item.doInstead, item.coachPhrase]) {
        expect(field.trim().length).toBeGreaterThan(0);
      }
      expect(item.sourceKeys.length).toBeGreaterThan(0);
    }
  });

  it("pekar bara på källor som finns", () => {
    const keys = new Set(MISTAKE_SOURCES.map((source) => source.key));
    expect(MISTAKE_SOURCES).toHaveLength(10);
    for (const item of COACH_MISTAKES) {
      for (const key of item.sourceKeys) expect(keys.has(key)).toBe(true);
    }
    for (const source of MISTAKE_SOURCES) expect(source.url.startsWith("https://")).toBe(true);
  });

  it("behåller instruktionens ordning på rubrikerna", () => {
    expect(mistakesByRank().map((item) => item.title)).toEqual([
      "Otryggt bemötande eller bristande säkerhet",
      "Resultatet går före barnen",
      "För lite glädje och motivation",
      "Tränaren pratar och styr för mycket",
      "För mycket kö och väntan",
      "För lite spel och egna beslut",
      "Barnen tränas som små vuxna",
      "Samma krav och övning för alla",
      "Feedbacken handlar mest om fel",
      "Otydliga ramar för föräldrar och ledare",
    ]);
  });
});
