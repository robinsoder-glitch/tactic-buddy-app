import { describe, expect, it } from "vitest";
import { ageAt, profileDisplayName, roleFromCodeMatch, validateSetup } from "./account-setup";

const today = new Date("2026-01-01T00:00:00Z");

describe("ageAt", () => {
  it("räknar hela år", () => {
    expect(ageAt("2008-01-01", today)).toBe(18);
    expect(ageAt("2008-06-01", today)).toBe(17);
  });
});

describe("validateSetup tränare", () => {
  const base = { role: "coach" as const, name: "Anna", birth: "1985-05-05", adultConfirmed: true };

  it("godkänner vuxen tränare", () => {
    expect(validateSetup(base)).toBeNull();
  });

  it("kräver namn", () => {
    expect(validateSetup({ ...base, name: " " })).toMatch(/namn/i);
  });

  it("kräver 18 år", () => {
    const birth = new Date();
    birth.setFullYear(birth.getFullYear() - 15);
    expect(validateSetup({ ...base, birth: birth.toISOString().slice(0, 10) })).toMatch(/18 år/);
  });

  it("kräver intyg", () => {
    expect(validateSetup({ ...base, adultConfirmed: false })).toMatch(/intyga/i);
  });
});

describe("validateSetup spelare", () => {
  it("kräver lagkod när den behövs", () => {
    expect(validateSetup({ role: "player", name: "Elias" }, { requireCode: true })).toMatch(
      /lagkod/i,
    );
    expect(
      validateSetup({ role: "player", name: "Elias", code: "A1B2C3" }, { requireCode: true }),
    ).toBeNull();
  });

  it("kräver spelarens namn för föräldrakonto", () => {
    expect(validateSetup({ role: "player", name: "Maria", isGuardian: true })).toMatch(
      /spelarens namn/i,
    );
  });

  it("hänvisar barn under 13 till föräldrakonto", () => {
    const birth = new Date();
    birth.setFullYear(birth.getFullYear() - 10);
    expect(
      validateSetup({ role: "player", name: "Elias", birth: birth.toISOString().slice(0, 10) }),
    ).toMatch(/vårdnadshavare/i);
  });
});

describe("roleFromCodeMatch", () => {
  it("ger tränare bara för tränarkod", () => {
    expect(roleFromCodeMatch({ join_role: "coach" })).toBe("coach");
    expect(roleFromCodeMatch({ join_role: "player" })).toBe("player");
    expect(roleFromCodeMatch(null)).toBeNull();
  });
});

describe("profileDisplayName", () => {
  it("visar vårdnadshavare tydligt", () => {
    expect(
      profileDisplayName({ role: "player", name: "Maria", isGuardian: true, playerName: "Elias" }),
    ).toBe("Maria");
    expect(profileDisplayName({ role: "coach", name: "Anna" })).toBe("Anna");
  });
});
