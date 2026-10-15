import { describe, expect, it } from "vitest";
import { buildIcs } from "./ics";
import type { TeamEvent } from "./teams";

const event: TeamEvent = {
  id: "match-1",
  team_id: "team-1",
  type: "match",
  title: "Testmatch",
  starts_at: "2026-10-20T17:00:00Z",
  ends_at: "2026-10-20T18:00:00Z",
  meet_at: null,
  home_team: null,
  away_team: null,
  kit: null,
  match_kind: null,
  series_id: null,
  location: "Testplan",
  notes: null,
};

describe("kalenderexport", () => {
  it("behåller samma UID när en bokning ställs in", () => {
    const active = buildIcs([event], "Testlag");
    const cancelled = buildIcs([{ ...event, cancelled_at: "2026-10-15T12:00:00Z" }], "Testlag");
    expect(active).toContain("UID:match-1@taktiktavlan");
    expect(cancelled).toContain("UID:match-1@taktiktavlan");
    expect(active).toContain("STATUS:CONFIRMED");
    expect(cancelled).toContain("STATUS:CANCELLED");
    expect(cancelled).toContain("SUMMARY:INSTÄLLD: Testlag – Testmatch");
    expect(cancelled).toContain("LAST-MODIFIED:20261015T120000Z");
  });

  it("behåller sluttiden och skyddar textfältens separatorer", () => {
    const content = buildIcs(
      [{ ...event, location: "Plan A, B; C", notes: "Rad 1\nRad 2" }],
      "Testlag",
    );
    expect(content).toContain("DTEND:20261020T180000Z");
    expect(content).toContain("LOCATION:Plan A\\, B\\; C");
    expect(content).toContain("DESCRIPTION:Rad 1\\nRad 2");
  });
});
