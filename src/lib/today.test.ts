import { describe, expect, it } from "vitest";
import { eventsMissingPlan, todayEventTitle, upcomingEvents, type TodayEvent } from "./today";

const base: TodayEvent = {
  id: "1",
  team_id: "t1",
  type: "training",
  title: null,
  starts_at: "2026-09-10T17:00:00Z",
  ends_at: null,
  meet_at: null,
  home_team: null,
  away_team: null,
  kit: null,
  match_kind: null,
  series_id: null,
  location: null,
  notes: null,
};

const now = new Date("2026-09-09T12:00:00Z");

describe("today", () => {
  it("visar bara kommande aktiviteter i tidsordning", () => {
    const list = upcomingEvents(
      [
        { ...base, id: "sen", starts_at: "2026-09-12T17:00:00Z" },
        { ...base, id: "gammal", starts_at: "2026-09-01T17:00:00Z" },
        { ...base, id: "snart", starts_at: "2026-09-10T17:00:00Z" },
      ],
      now,
    );
    expect(list.map((item) => item.id)).toEqual(["snart", "sen"]);
  });

  it("räknar inte inställda aktiviteter", () => {
    const list = upcomingEvents([{ ...base, cancelled_at: "2026-09-09T08:00:00Z" }], now);
    expect(list).toHaveLength(0);
  });

  it("hittar aktiviteter utan sparad planering", () => {
    const list = eventsMissingPlan(
      [
        { ...base, id: "a" },
        { ...base, id: "b", starts_at: "2026-09-11T17:00:00Z" },
      ],
      ["a"],
      now,
    );
    expect(list.map((item) => item.id)).toEqual(["b"]);
  });

  it("ger begriplig rubrik för match utan titel", () => {
    expect(todayEventTitle({ ...base, type: "match", home_team: "IFK", away_team: "AIK" })).toBe(
      "IFK – AIK",
    );
    expect(todayEventTitle(base)).toBe("Träning");
  });
});
