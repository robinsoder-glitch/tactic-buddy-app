import { describe, expect, it } from "vitest";
import {
  attendanceCsv,
  counts,
  eventLabel,
  pastEvents,
  percent,
  registeredCount,
  summarize,
  type AttendanceRow,
} from "./attendance";
import type { TeamEvent } from "./teams";

const event = (id: string, type: "training" | "match", starts_at: string): TeamEvent =>
  ({
    id,
    team_id: "team-1",
    type,
    title: null,
    starts_at,
    ends_at: null,
    meet_at: null,
    home_team: "Högalids IF",
    away_team: "AIK FF",
    kit: null,
    match_kind: null,
    series_id: null,
    location: null,
    notes: null,
  }) as TeamEvent;

const events = [
  event("t1", "training", "2026-08-01T17:00:00Z"),
  event("t2", "training", "2026-08-08T17:00:00Z"),
  event("m1", "match", "2026-08-10T09:00:00Z"),
  event("t3", "training", "2027-01-01T17:00:00Z"),
];

const rows: AttendanceRow[] = [
  { id: "1", event_id: "t1", team_id: "team-1", player_id: "p1", status: "present", note: null },
  { id: "2", event_id: "t2", team_id: "team-1", player_id: "p1", status: "late", note: null },
  { id: "3", event_id: "m1", team_id: "team-1", player_id: "p1", status: "absent", note: null },
  { id: "4", event_id: "t1", team_id: "team-1", player_id: "p2", status: "sick", note: null },
];

describe("närvaro", () => {
  it("räknar bara genomförda händelser", () => {
    const done = pastEvents(events, new Date("2026-08-30T00:00:00Z"));
    expect(done.map((item) => item.id)).toEqual(["t1", "t2", "m1"]);
  });

  it("sen ankomst räknas som deltagande", () => {
    expect(counts("late")).toBe(true);
    expect(counts("sick")).toBe(false);
  });

  it("sammanställer träningar och matcher per spelare", () => {
    const done = pastEvents(events, new Date("2026-08-30T00:00:00Z"));
    const [p1, p2] = summarize(
      [
        { id: "p1", name: "Vincent" },
        { id: "p2", name: "Alma" },
      ],
      done,
      rows,
    );
    expect(p1?.trainings).toBe(2);
    expect(p1?.trainingsTotal).toBe(2);
    expect(p1?.matches).toBe(0);
    expect(p1?.absent).toBe(1);
    expect(p2?.trainings).toBe(0);
    expect(p2?.sick).toBe(1);
  });

  it("beräknar närvaro i procent", () => {
    expect(percent(1, 2)).toBe(50);
    expect(percent(0, 0)).toBe(0);
  });

  it("räknar registrerade spelare per händelse", () => {
    expect(registeredCount(rows, "t1")).toBe(2);
    expect(registeredCount(rows, "m1")).toBe(1);
  });

  it("bygger csv med svenska rubriker", () => {
    const csv = attendanceCsv(
      summarize([{ id: "p1", name: "Vincent" }], pastEvents(events, new Date("2026-08-30T00:00:00Z")), rows),
    );
    expect(csv.split("\n")[0]).toContain("Träningsnärvaro %");
    expect(csv).toContain("Vincent;2;2;100;0;1;0");
  });

  it("visar matchrubrik när titel saknas", () => {
    expect(eventLabel(events[2] as TeamEvent)).toBe("Högalids IF – AIK FF");
    expect(eventLabel(events[0] as TeamEvent)).toBe("Träning");
  });
});
