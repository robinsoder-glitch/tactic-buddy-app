import { describe, expect, it } from "vitest";
import { ageFromAgeGroup, birthYearFromAgeGroup, isGuardianOnlyTeam } from "./team-age";

const now = new Date("2026-05-01T00:00:00Z");

describe("team-age", () => {
  it("läser födelseår ur åldersgruppen", () => {
    expect(birthYearFromAgeGroup("P2015")).toBe(2015);
    expect(birthYearFromAgeGroup("F 2016 blå")).toBe(2016);
    expect(birthYearFromAgeGroup("Herr A")).toBeNull();
    expect(birthYearFromAgeGroup(null)).toBeNull();
  });

  it("räknar ålder utifrån året", () => {
    expect(ageFromAgeGroup("P2015", now)).toBe(11);
    expect(ageFromAgeGroup("P2010", now)).toBe(16);
  });

  it("yngre lag får bara vårdnadshavarkonton", () => {
    expect(isGuardianOnlyTeam({ age_group: "P2015" }, now)).toBe(true);
    expect(isGuardianOnlyTeam({ age_group: "P2014" }, now)).toBe(false);
    expect(isGuardianOnlyTeam({ age_group: "P2010" }, now)).toBe(false);
  });

  it("lagets egen inställning vinner över åldern", () => {
    expect(isGuardianOnlyTeam({ age_group: "P2015", guardian_only: false }, now)).toBe(false);
    expect(isGuardianOnlyTeam({ age_group: "P2008", guardian_only: true }, now)).toBe(true);
  });

  it("okänd åldersgrupp ger vanligt lag", () => {
    expect(isGuardianOnlyTeam({ age_group: null }, now)).toBe(false);
    expect(isGuardianOnlyTeam(null, now)).toBe(false);
  });
});
