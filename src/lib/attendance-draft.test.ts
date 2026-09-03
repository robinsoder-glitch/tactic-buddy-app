import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import {
  attendanceStarted,
  counterLabel,
  draftFromInvitations,
  draftFromRows,
  isDirty,
  markAll,
  registeredInDraft,
  setEntry,
  statusFromInvite,
  toPayload,
  unregisteredIds,
} from "./attendance-draft";
import type { AttendanceRow } from "./attendance";

const players = ["p1", "p2", "p3", "p4", "p5"];

function row(patch: Partial<AttendanceRow>): AttendanceRow {
  return {
    id: "a1",
    event_id: "e1",
    team_id: "t1",
    player_id: "p1",
    status: "present",
    note: null,
    minutes_played: null,
    ...patch,
  };
}

describe("närvaroutkast från kallelsesvar", () => {
  it("översätter alla fyra svaren", () => {
    expect(statusFromInvite("attending")).toBe("present");
    expect(statusFromInvite("declined")).toBe("absent");
    expect(statusFromInvite("maybe")).toBeNull();
    expect(statusFromInvite("pending")).toBeNull();
  });

  it("lämnar okallade spelare oregistrerade", () => {
    const draft = draftFromInvitations(
      players,
      [
        { player_id: "p1", status: "attending" },
        { player_id: "p2", status: "declined" },
        { player_id: "p3", status: "maybe" },
        { player_id: "p4", status: "pending" },
      ],
      [],
    );
    expect(draft["p1"]?.status).toBe("present");
    expect(draft["p2"]?.status).toBe("absent");
    expect(draft["p3"]?.status).toBeNull();
    expect(draft["p4"]?.status).toBeNull();
    expect(draft["p5"]?.status).toBeNull();
  });

  it("skriver aldrig över redan sparad närvaro", () => {
    const saved = [row({ player_id: "p1", status: "absent" })];
    const draft = draftFromInvitations(players, [{ player_id: "p1", status: "attending" }], saved);
    expect(draft["p1"]?.status).toBe("absent");
    expect(attendanceStarted(saved)).toBe(true);
    expect(attendanceStarted([])).toBe(false);
  });
});

describe("snabbregistrering", () => {
  it("markerar alla närvarande och räknar", () => {
    const draft = markAll(draftFromRows(players, []), "present");
    expect(registeredInDraft(draft)).toBe(5);
    expect(counterLabel(draft, 5)).toBe("5 av 5 registrerade");
    expect(unregisteredIds(draft)).toEqual([]);
  });

  it("hittar osparade ändringar", () => {
    const saved = draftFromRows(players, [row({ player_id: "p1" })]);
    expect(isDirty(saved, saved)).toBe(false);
    expect(isDirty(setEntry(saved, "p2", { status: "absent" }), saved)).toBe(true);
    expect(isDirty(setEntry(saved, "p1", { note: "  " }), saved)).toBe(false);
  });

  it("filtrerar ej registrerade", () => {
    const draft = setEntry(draftFromRows(players, []), "p1", { status: "partial" });
    expect(unregisteredIds(draft)).toEqual(["p2", "p3", "p4", "p5"]);
    expect(counterLabel(draft, 5)).toBe("1 av 5 registrerade");
  });
});

describe("underlag till sparning", () => {
  it("skickar bara registrerade rader", () => {
    let draft = draftFromRows(players, []);
    draft = setEntry(draft, "p1", { status: "present", minutes: 40 });
    draft = setEntry(draft, "p2", { status: "absent", reason: "sick", minutes: 30 });
    const payload = toPayload(draft, "match");
    expect(payload).toHaveLength(2);
    expect(payload[0]).toMatchObject({ player_id: "p1", minutes_played: 40, absence_reason: null });
    expect(payload[1]).toMatchObject({ absence_reason: "sick", minutes_played: null });
  });

  it("sparar inte speltid för träning", () => {
    const draft = setEntry(draftFromRows(players, []), "p1", { status: "present", minutes: 40 });
    expect(toPayload(draft, "training")[0]?.minutes_played).toBeNull();
  });
});
