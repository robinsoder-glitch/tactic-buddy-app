import { describe, expect, it } from "vitest";
import { isMatchStatus, matchStatus } from "./match-status";

const now = new Date("2026-09-11T12:00:00Z");

describe("matchstatus", () => {
  it("visar planerad när inga kallelser skickats", () => {
    expect(matchStatus({ startsAt: "2026-09-20T10:00:00Z", hasInvitations: false, now })).toBe(
      "planerad",
    );
  });

  it("visar skickad när kallelser finns", () => {
    expect(matchStatus({ startsAt: "2026-09-20T10:00:00Z", hasInvitations: true, now })).toBe(
      "skickad",
    );
  });

  it("visar spelad när matchen passerat", () => {
    expect(matchStatus({ startsAt: "2026-09-01T10:00:00Z", hasInvitations: true, now })).toBe(
      "spelad",
    );
  });

  it("låter tränarens val gå före", () => {
    expect(
      matchStatus({
        override: "spelad",
        startsAt: "2026-09-20T10:00:00Z",
        hasInvitations: false,
        now,
      }),
    ).toBe("spelad");
    expect(
      matchStatus({
        override: "planerad",
        startsAt: "2026-09-01T10:00:00Z",
        hasInvitations: true,
        now,
      }),
    ).toBe("planerad");
  });

  it("ignorerar okända värden", () => {
    expect(isMatchStatus("klar")).toBe(false);
    expect(
      matchStatus({
        override: "klar",
        startsAt: "2026-09-20T10:00:00Z",
        hasInvitations: true,
        now,
      }),
    ).toBe("skickad");
  });
});
