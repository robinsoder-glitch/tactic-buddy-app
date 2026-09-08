import { describe, expect, it } from "vitest";
import { PLAYER_RULEBOOK } from "./player-rules";
import { FAIR_PLAY_RULES } from "./fair-play";

describe("spelarnas regelbok", () => {
  it("har sex kapitel i nummerordning", () => {
    expect(PLAYER_RULEBOOK).toHaveLength(6);
    expect(PLAYER_RULEBOOK.map((c) => c.number)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("har minst tre paragrafer per kapitel", () => {
    for (const chapter of PLAYER_RULEBOOK) {
      expect(chapter.rules.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("har unika paragrafnummer inom varje kapitel och ifyllda texter", () => {
    for (const chapter of PLAYER_RULEBOOK) {
      const numbers = chapter.rules.map((r) => r.number);
      expect(new Set(numbers).size).toBe(numbers.length);
      for (const rule of chapter.rules) {
        expect(rule.title.trim().length).toBeGreaterThan(0);
        expect(rule.text.trim().length).toBeGreaterThan(0);
      }
      expect(chapter.title.trim().length).toBeGreaterThan(0);
      expect(chapter.intro.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("fair play", () => {
  it("har exakt tio punkter i nummerordning", () => {
    expect(FAIR_PLAY_RULES).toHaveLength(10);
    expect(FAIR_PLAY_RULES.map((r) => r.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
