import { describe, expect, it } from "vitest";
import { buildTeamInviteUrl, teamCodeFromToken, teamCodeToken } from "./invite-links";

describe("lagets gemensamma inbjudan", () => {
  it("bygger en token av lagkoden", () => {
    expect(teamCodeToken("abc123")).toBe("kod-ABC123");
  });

  it("läser ut lagkoden ur en token", () => {
    expect(teamCodeFromToken("kod-abc123")).toBe("ABC123");
  });

  it("ger null för personliga inbjudningstoken", () => {
    expect(teamCodeFromToken("9f0c2b1d-4c1a-4b2e-9c0a-1a2b3c4d5e6f")).toBeNull();
    expect(teamCodeFromToken(null)).toBeNull();
  });

  it("bygger full adress", () => {
    expect(buildTeamInviteUrl("https://fotbollsrummet.app/", "ABC123")).toBe(
      "https://fotbollsrummet.app/inbjudan/kod-ABC123",
    );
  });
});
