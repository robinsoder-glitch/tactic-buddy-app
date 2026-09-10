import { describe, expect, it } from "vitest";
import {
  destinationAfterSetup,
  safeReturnPath,
  shouldRedirectToOnboarding,
} from "./onboarding-routing";

describe("safeReturnPath", () => {
  it("tillåter interna sidor", () => {
    expect(safeReturnPath("/kalender")).toBe("/kalender");
    expect(safeReturnPath("/team/abc?flik=1")).toBe("/team/abc?flik=1");
  });

  it("stoppar externa och tomma adresser", () => {
    expect(safeReturnPath("//example.com")).toBeNull();
    expect(safeReturnPath("https://example.com")).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
  });

  it("skickar aldrig tillbaka till inloggning eller kontotyp", () => {
    expect(safeReturnPath("/auth")).toBeNull();
    expect(safeReturnPath("/onboarding")).toBeNull();
    expect(safeReturnPath("/reset-password")).toBeNull();
  });
});

describe("shouldRedirectToOnboarding", () => {
  it("styr om skyddade sidor när kontotyp saknas", () => {
    expect(shouldRedirectToOnboarding("/kalender", true)).toBe(true);
    expect(shouldRedirectToOnboarding("/team/abc", true)).toBe(true);
  });

  it("låter kontotypssidan vara i fred", () => {
    expect(shouldRedirectToOnboarding("/onboarding", true)).toBe(false);
  });

  it("gör inget för färdiga konton", () => {
    expect(shouldRedirectToOnboarding("/kalender", false)).toBe(false);
  });
});

describe("destinationAfterSetup", () => {
  it("återvänder till sidan användaren ville åt", () => {
    expect(destinationAfterSetup({ returnPath: "/kalender", role: "coach" })).toEqual({
      to: "/kalender",
    });
  });

  it("går till laget när ansökan är godkänd direkt", () => {
    expect(destinationAfterSetup({ teamId: "t1", role: "player" })).toEqual({
      to: "/team/$teamId",
      teamId: "t1",
    });
  });

  it("går till startsidan vid väntande ansökan", () => {
    expect(destinationAfterSetup({ teamId: "t1", status: "pending", role: "player" })).toEqual({
      to: "/",
    });
  });

  it("tränare utan lag hamnar på lagsidan", () => {
    expect(destinationAfterSetup({ role: "coach" })).toEqual({ to: "/teams" });
  });
});
