import { describe, expect, it } from "vitest";
import { PLAYER_RULEBOOK, PLAYER_RULEBOOK_5V5, rulebookForFormat } from "./player-rules";
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

describe("regelbok för 5 mot 5", () => {
  it("väljs för lag som spelar 5 mot 5", () => {
    for (const format of ["5v5", "5 mot 5", "5-manna"]) {
      expect(rulebookForFormat(format).chapters).toBe(PLAYER_RULEBOOK_5V5);
      expect(rulebookForFormat(format).formatLabel).toBe("5 mot 5");
    }
  });

  it("används inte för andra spelformer", () => {
    for (const format of ["7v7", "9v9", "11 mot 11", null]) {
      expect(rulebookForFormat(format).chapters).toBe(PLAYER_RULEBOOK);
    }
  });

  it("har inget inkast, ingen offside och ingen straffspark", () => {
    const text = JSON.stringify(PLAYER_RULEBOOK_5V5).toLowerCase();
    expect(text).toContain("tre perioder");
    expect(text).toContain("sidlinjespark");
    expect(text).toContain("retreatlinje");
    expect(text).not.toContain("inkast");
    expect(text).toContain("ingen offside");
    expect(text).toContain("ingen straffspark");
  });
});
