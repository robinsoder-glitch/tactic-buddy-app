import { describe, expect, it } from "vitest";
import {
  attendanceCsv,
  counts,
  eventLabel,
  minutesFromShare,
  playingTimeShare,
  validateMinutes,
  pastEvents,
  percent,
  registeredCount,
  summarize,
  type AttendanceRow,
} from "./attendance";
import { findSimilarPlayers, type TeamEvent } from "./teams";

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

const cancelled = {
  ...event("m2", "match", "2026-08-11T09:00:00Z"),
  cancelled_at: "2026-08-10T20:00:00Z",
} as TeamEvent;

const rows: AttendanceRow[] = [
  {
    id: "1",
    event_id: "t1",
    team_id: "team-1",
    player_id: "p1",
    status: "present",
    note: null,
    minutes_played: null,
  },
  {
    id: "2",
    event_id: "t2",
    team_id: "team-1",
    player_id: "p1",
    status: "partial",
    note: null,
    minutes_played: null,
  },
  {
    id: "3",
    event_id: "m1",
    team_id: "team-1",
    player_id: "p1",
    status: "absent",
    note: null,
    minutes_played: 0,
  },
  {
    id: "4",
    event_id: "t1",
    team_id: "team-1",
    player_id: "p2",
    status: "absent",
    note: null,
    minutes_played: null,
  },
];

describe("närvaro", () => {
  it("räknar bara genomförda händelser", () => {
    const done = pastEvents(events, new Date("2026-08-30T00:00:00Z"));
    expect(done.map((item) => item.id)).toEqual(["t1", "t2", "m1"]);
  });

  it("del av aktiviteten räknas som deltagande", () => {
    expect(counts("partial")).toBe(true);
    expect(counts("absent")).toBe(false);
  });

  it("räknar om snabbval och andel av matchen", () => {
    expect(minutesFromShare(0.75, 60)).toBe(45);
    expect(minutesFromShare(0.5, null)).toBeNull();
    expect(playingTimeShare(30, 45)).toBe(67);
    expect(playingTimeShare(30, null)).toBeNull();
  });

  it("validerar speltid mot matchens längd", () => {
    expect(validateMinutes(30, 45)).toBeNull();
    expect(validateMinutes(-1, 45)).toContain("negativ");
    expect(validateMinutes(60, 45)).toContain("45");
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
    expect(p2?.absent).toBe(1);
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
      summarize(
        [{ id: "p1", name: "Vincent" }],
        pastEvents(events, new Date("2026-08-30T00:00:00Z")),
        rows,
      ),
    );
    expect(csv.split("\n")[0]).toContain("Träningsnärvaro %");
    expect(csv).toContain("Vincent;2;2;100;0;1;0");
  });

  it("visar matchrubrik när titel saknas", () => {
    expect(eventLabel(events[2] as TeamEvent)).toBe("Högalids IF – AIK FF");
    expect(eventLabel(events[0] as TeamEvent)).toBe("Träning");
  });
});

describe("liknande spelarnamn", () => {
  const squad = [
    { id: "p1", name: "Vincent Åkesson" },
    { id: "p2", name: "Alma Berg" },
  ];

  it("varnar för samma namn oavsett skiftläge och accenter", () => {
    expect(findSimilarPlayers("vincent akesson", squad).map((p) => p.id)).toEqual(["p1"]);
    expect(findSimilarPlayers("Nils Ek", squad)).toEqual([]);
    expect(findSimilarPlayers("Alma Berg", squad, "p2")).toEqual([]);
  });
});

describe("pastEvents", () => {
  it("räknar aldrig inställda händelser som genomförda", () => {
    const done = pastEvents([...events, cancelled], new Date("2026-08-30T00:00:00Z"));
    expect(done.map((item) => item.id)).not.toContain("m2");
    expect(done.map((item) => item.id)).toContain("m1");
  });

  it("räknar inte framtida händelser", () => {
    const done = pastEvents(events, new Date("2026-08-30T00:00:00Z"));
    expect(done.map((item) => item.id)).not.toContain("t3");
  });
});
