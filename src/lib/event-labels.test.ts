import { describe, expect, it } from "vitest";
import { eventBadges, eventDisplayTitle, eventTypeLabel } from "./event-labels";

describe("Kalenderkort utan dubbla ord", () => {
  it("visar typ och titel separat", () => {
    const event = { type: "training", title: "Passningsspel" };
    expect(eventTypeLabel(event)).toBe("Träning");
    expect(eventDisplayTitle(event)).toBe("Passningsspel");
    expect(`${eventTypeLabel(event)}${eventDisplayTitle(event)}`).not.toContain("TräningTräning");
  });

  it("faller tillbaka på typens namn utan att dubblera", () => {
    for (const type of ["training", "match"]) {
      const label = eventDisplayTitle({ type });
      expect(label).toBe(type === "match" ? "Match" : "Träning");
      expect(eventBadges({ type })).toEqual([label]);
    }
  });

  it("dubblerar inte när titeln är samma ord som typen", () => {
    expect(eventDisplayTitle({ type: "match", title: "Match" })).toBe("Match");
    expect(eventDisplayTitle({ type: "training", title: " träning " })).toBe("Träning");
  });

  it("visar lagen för match utan egen titel", () => {
    expect(eventDisplayTitle({ type: "match", home_team: "IFK", away_team: "AIK" })).toBe(
      "IFK – AIK",
    );
  });

  it("visar Inställd som separat statusbadge", () => {
    const badges = eventBadges({ type: "training", title: "Titel", cancelled_at: "2026-01-01" });
    expect(badges).toEqual(["Träning", "Inställd"]);
    expect(badges.join("")).not.toContain("TitelTräning");
  });
});
