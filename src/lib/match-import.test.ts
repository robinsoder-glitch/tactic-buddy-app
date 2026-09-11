import { describe, expect, it } from "vitest";
import {
  normalizeDate,
  normalizeImportedMatches,
  normalizeTime,
  toIsoStart,
  withoutExisting,
} from "./match-import";

describe("tolkning av matchdatum", () => {
  it("förstår svenska format", () => {
    expect(normalizeDate("2026-05-09", 2026)).toBe("2026-05-09");
    expect(normalizeDate("9/5", 2026)).toBe("2026-05-09");
    expect(normalizeDate("09.05.26", 2026)).toBe("2026-05-09");
    expect(normalizeDate("9 maj", 2026)).toBe("2026-05-09");
  });

  it("avvisar omöjliga datum", () => {
    expect(normalizeDate("31/2", 2026)).toBeNull();
    expect(normalizeDate("", 2026)).toBeNull();
    expect(normalizeDate("nästa vecka", 2026)).toBeNull();
  });

  it("tolkar tider", () => {
    expect(normalizeTime("18.30")).toBe("18:30");
    expect(normalizeTime("kl 09:05")).toBe("09:05");
    expect(normalizeTime("1830")).toBe("18:30");
    expect(normalizeTime("nn")).toBeNull();
  });
});

describe("normalisering av inlästa matcher", () => {
  const options = { teamName: "QA Lag P2015", seasonYear: 2026 };

  it("rensar, sorterar och markerar osäkra rader", () => {
    const rows = normalizeImportedMatches(
      [
        { date: "2026-06-12", time: "11:00", home_team: "IFK", away_team: "QA Lag P2015" },
        { date: "9 maj", time: "", home_team: "QA Lag P2015", away_team: "IFK" },
        { date: "trams", time: "10:00" },
      ],
      options,
    );
    expect(rows.map((row) => row.date)).toEqual(["2026-05-09", "2026-06-12"]);
    expect(rows[0]?.time).toBe("10:00");
    expect(rows[0]?.needsReview).toBe(true);
    expect(rows[1]?.needsReview).toBe(false);
  });

  it("tar bort dubbletter i källan", () => {
    const rows = normalizeImportedMatches(
      [
        { date: "2026-05-09", time: "10:00", home_team: "A", away_team: "IFK" },
        { date: "2026-05-09", time: "10:00", home_team: "A", away_team: "IFK" },
      ],
      options,
    );
    expect(rows.length).toBe(1);
  });

  it("hoppar över matcher som redan finns i kalendern", () => {
    const rows = normalizeImportedMatches(
      [{ date: "2026-05-09", time: "10:00", home_team: "A", away_team: "IFK" }],
      options,
    );
    const existing = [{ starts_at: new Date(2026, 4, 9, 10, 0).toISOString() }];
    expect(withoutExisting(rows, existing)).toEqual([]);
  });

  it("gör om datum och tid till ISO", () => {
    const iso = toIsoStart({ date: "2026-05-09", time: "10:00" });
    expect(iso).toBe(new Date(2026, 4, 9, 10, 0).toISOString());
  });
});
