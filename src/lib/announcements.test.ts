import { describe, expect, it } from "vitest";
import {
  audienceLabel,
  audienceNeedsEvent,
  canRemind,
  countUnreadInbox,
  messageTime,
  priorityLabel,
  readSummary,
  sortInbox,
  statusLabel,
  validateDraft,
} from "./announcements";

const draft = {
  title: "Träningen flyttad",
  body: "Vi börjar 18.30 i stället.",
  teamId: "team-1",
  audience: "all" as const,
  eventId: null,
  scheduledFor: null,
};

describe("viktiga meddelanden", () => {
  it("kräver lag, rubrik och text", () => {
    expect(validateDraft(draft)).toBeNull();
    expect(validateDraft({ ...draft, teamId: null })).toMatch(/lag/i);
    expect(validateDraft({ ...draft, title: "  " })).toMatch(/rubrik/i);
    expect(validateDraft({ ...draft, body: "" })).toMatch(/meddelande/i);
  });

  it("kräver aktivitet för aktivitetsmålgrupper", () => {
    expect(audienceNeedsEvent("event_going")).toBe(true);
    expect(audienceNeedsEvent("guardians")).toBe(false);
    expect(validateDraft({ ...draft, audience: "event_no_reply" })).toMatch(/aktivitet/i);
    expect(validateDraft({ ...draft, audience: "event_no_reply", eventId: "e1" })).toBeNull();
  });

  it("kräver att schemalagd tid ligger framåt", () => {
    const now = new Date("2026-09-03T18:00:00Z");
    expect(validateDraft({ ...draft, scheduledFor: "2026-09-03T17:00:00Z" }, now)).toMatch(
      /framåt/,
    );
    expect(validateDraft({ ...draft, scheduledFor: "2026-09-04T17:00:00Z" }, now)).toBeNull();
  });

  it("visar målgrupp, prioritet och status på svenska", () => {
    expect(audienceLabel("guardians")).toBe("Alla vårdnadshavare");
    expect(priorityLabel("important")).toBe("Viktigt");
    expect(statusLabel("scheduled")).toBe("Schemalagt");
    expect(statusLabel("published")).toBe("Publicerat");
  });

  it("sorterar olästa först och räknar olästa", () => {
    const items = [
      { read_at: "2026-09-01T10:00:00Z", published_at: "2026-09-03T10:00:00Z", id: "a" },
      { read_at: null, published_at: "2026-09-01T10:00:00Z", id: "b" },
      { read_at: null, published_at: "2026-09-02T10:00:00Z", id: "c" },
    ];
    expect(sortInbox(items).map((item) => item.id)).toEqual(["c", "b", "a"]);
    expect(sortInbox(items, false).map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(countUnreadInbox(items)).toBe(2);
  });

  it("sammanställer lässtatus med personer utan konto", () => {
    const summary = readSummary([{ read_at: "x" }, { read_at: null }, { read_at: null }], 2);
    expect(summary).toEqual({ read: 1, unread: 2, withoutAccount: 2 });
  });

  it("har dubblettskydd på påminnelser i en timme", () => {
    const now = new Date("2026-09-03T18:00:00Z");
    expect(canRemind(null, now)).toBe(true);
    expect(canRemind("2026-09-03T17:30:00Z", now)).toBe(false);
    expect(canRemind("2026-09-03T16:30:00Z", now)).toBe(true);
  });

  it("visar tid i svensk form", () => {
    expect(messageTime(null)).toBe("");
    expect(messageTime("inte en tid")).toBe("");
    expect(messageTime("2026-09-03T16:00:00Z")).toContain("18:00");
  });
});
