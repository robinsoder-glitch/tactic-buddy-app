import { describe, expect, it } from "vitest";
import {
  canEditTemplate,
  durationBucket,
  filterSessions,
  templateCards,
  visibleTemplates,
} from "./session-templates";
import type { CoachSession, CoachSessionItem } from "./coach-sessions";

function session(patch: Partial<CoachSession> & { id: string }): CoachSession {
  return {
    user_id: "coach-1",
    title: "Pass",
    session_date: "2026-09-01",
    age_group: "P10",
    game_format: "5v5",
    theme: "Spelbarhet",
    goal: null,
    notes: null,
    status: "draft",
    template_id: null,
    team_id: "team-1",
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    ...patch,
  } as CoachSession;
}

function item(sessionId: string, minutes: number, index: number): CoachSessionItem {
  return {
    id: `${sessionId}-${index}`,
    session_id: sessionId,
    kind: "drill",
    title: "Övning",
    resource_id: null,
    minutes,
    note: null,
    sort_order: index,
  };
}

describe("mallar", () => {
  const own = {
    ...session({ id: "t1" }),
    is_template: true,
    visibility: "private",
  } as CoachSession;
  const teamTemplate = {
    ...session({ id: "t2", user_id: "coach-2" }),
    is_template: true,
    visibility: "team",
  } as CoachSession;
  const otherPrivate = {
    ...session({ id: "t3", user_id: "coach-2" }),
    is_template: true,
    visibility: "private",
  } as CoachSession;
  const plain = session({ id: "s1" });

  it("visar egna mallar och lagmallar men inte andras privata", () => {
    const list = visibleTemplates([own, teamTemplate, otherPrivate, plain], "coach-1");
    expect(list.map((row) => row.id)).toEqual(["t1", "t2"]);
  });

  it("bara skaparen får ändra mallen", () => {
    expect(canEditTemplate(own, "coach-1")).toBe(true);
    expect(canEditTemplate(teamTemplate, "coach-1")).toBe(false);
  });

  it("mallkortet räknar moment och tid", () => {
    const cards = templateCards([own], [item("t1", 20, 0), item("t1", 25, 1)], "coach-1");
    expect(cards[0]?.minutes).toBe(45);
    expect(cards[0]?.itemCount).toBe(2);
    expect(cards[0]?.visibilityLabel).toBe("Privat mall");
  });
});

describe("filter för tidigare pass", () => {
  const a = session({ id: "s1", theme: "Spelbarhet", status: "done" });
  const b = session({ id: "s2", theme: "Press", session_date: "2026-08-01", team_id: "team-2" });
  const items = [item("s1", 30, 0), item("s1", 30, 1), item("s2", 45, 0)];

  it("filtrerar på lag, tema, status och datum", () => {
    expect(filterSessions([a, b], items, { teamId: "team-1" }).map((s) => s.id)).toEqual(["s1"]);
    expect(filterSessions([a, b], items, { theme: "Press" }).map((s) => s.id)).toEqual(["s2"]);
    expect(filterSessions([a, b], items, { status: "done" }).map((s) => s.id)).toEqual(["s1"]);
    expect(filterSessions([a, b], items, { fromDate: "2026-08-15" }).map((s) => s.id)).toEqual([
      "s1",
    ]);
  });

  it("filtrerar på tidsfack", () => {
    expect(filterSessions([a, b], items, { duration: 60 }).map((s) => s.id)).toEqual(["s1"]);
    expect(filterSessions([a, b], items, { duration: 45 }).map((s) => s.id)).toEqual(["s2"]);
  });

  it("mallar räknas inte som tidigare pass", () => {
    const template = { ...a, is_template: true } as CoachSession;
    expect(filterSessions([template], items, {})).toEqual([]);
  });

  it("närmaste tidsfack", () => {
    expect(durationBucket(50)).toBe(45);
    expect(durationBucket(58)).toBe(60);
    expect(durationBucket(80)).toBe(75);
  });
});
