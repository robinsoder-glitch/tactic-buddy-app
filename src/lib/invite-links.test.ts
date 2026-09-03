import { describe, expect, it } from "vitest";
import {
  buildInviteUrl,
  canAcceptInvite,
  INVITE_PREVIEW_MESSAGES,
  inviteAuthPath,
  inviteExpiryText,
  inviteRoleLabel,
  joinSourceLabel,
  safeNextPath,
} from "./invite-links";

describe("inbjudningslänkar", () => {
  it("bara en aktiv inbjudan kan accepteras", () => {
    expect(canAcceptInvite("active")).toBe(true);
    for (const state of ["expired", "used", "revoked", "archived", "invalid"] as const) {
      expect(canAcceptInvite(state)).toBe(false);
      expect(INVITE_PREVIEW_MESSAGES[state]).toMatch(/\S/);
    }
  });

  it("bygger länken som också kodas i QR-koden", () => {
    expect(buildInviteUrl("https://exempel.se/", "abc123")).toBe(
      "https://exempel.se/inbjudan/abc123",
    );
  });

  it("tar användaren tillbaka till inbjudan efter inloggning", () => {
    expect(inviteAuthPath("abc", "signin")).toBe("/auth?next=%2Finbjudan%2Fabc");
    expect(inviteAuthPath("abc", "signup")).toBe("/auth?mode=signup&next=%2Finbjudan%2Fabc");
  });

  it("släpper bara igenom interna vägar", () => {
    expect(safeNextPath("/inbjudan/abc")).toBe("/inbjudan/abc");
    expect(safeNextPath("//elak.se")).toBeNull();
    expect(safeNextPath("https://elak.se")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });

  it("skriver roller och källor på svenska", () => {
    expect(inviteRoleLabel("coach")).toBe("Tränare eller ledare");
    expect(inviteRoleLabel("player")).toBe("Spelare eller vårdnadshavare");
    expect(joinSourceLabel("player_code")).toBe("spelarkod");
    expect(joinSourceLabel("coach_code")).toBe("tränarkod");
    expect(joinSourceLabel("invite_link")).toBe("personlig länk");
    expect(joinSourceLabel(null)).toBe("okänd väg");
  });

  it("visar sista giltighetsdag eller inget alls", () => {
    expect(inviteExpiryText("2026-09-20T10:00:00Z")).toContain("2026");
    expect(inviteExpiryText(null)).toBe("");
    expect(inviteExpiryText("inte ett datum")).toBe("");
  });
});
