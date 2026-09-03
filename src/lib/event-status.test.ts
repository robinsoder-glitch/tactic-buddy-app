import { describe, expect, it } from "vitest";
import {
  coachPrimaryAction,
  eventState,
  memberPrimaryAction,
  stepStatuses,
  type EventSnapshot,
} from "./event-status";

const NOW = Date.parse("2026-09-03T12:00:00Z");

function snap(patch: Partial<EventSnapshot> = {}): EventSnapshot {
  return {
    now: NOW,
    startsAt: "2026-09-10T16:00:00Z",
    endsAt: "2026-09-10T17:30:00Z",
    cancelledAt: null,
    type: "match",
    hasLocation: true,
    pendingMembers: 0,
    invitationCount: 12,
    pendingResponses: 0,
    planDone: true,
    runActive: false,
    runFinished: false,
    attendanceCount: 0,
    expectedPlayers: 12,
    hasFollowup: false,
    ...patch,
  };
}

describe("eventState", () => {
  it("ger kommande, pågår, genomförd och inställd", () => {
    expect(eventState({ now: NOW, startsAt: "2026-09-10T16:00:00Z" })).toBe("upcoming");
    expect(
      eventState({
        now: NOW,
        startsAt: "2026-09-03T11:30:00Z",
        endsAt: "2026-09-03T13:00:00Z",
      }),
    ).toBe("ongoing");
    expect(eventState({ now: NOW, startsAt: "2026-09-01T16:00:00Z" })).toBe("done");
    expect(
      eventState({
        now: NOW,
        startsAt: "2026-09-10T16:00:00Z",
        cancelledAt: "2026-09-02T10:00:00Z",
      }),
    ).toBe("cancelled");
  });

  it("använder standardlängd när sluttid saknas", () => {
    expect(eventState({ now: NOW, startsAt: "2026-09-03T11:00:00Z" })).toBe("ongoing");
  });
});

describe("stepStatuses", () => {
  it("kallelse är inte påbörjad utan kallelser", () => {
    expect(stepStatuses(snap({ invitationCount: 0 })).invitation).toBe("not_started");
  });

  it("kallelse pågår vid blandade svar", () => {
    expect(stepStatuses(snap({ pendingResponses: 3 })).invitation).toBe("in_progress");
  });

  it("kallelse är klar när tränaren går vidare trots obesvarade", () => {
    expect(stepStatuses(snap({ pendingResponses: 3, invitationClosed: true })).invitation).toBe(
      "done",
    );
  });

  it("genomförande pågår när ett aktivt pass finns", () => {
    expect(stepStatuses(snap({ runActive: true })).execution).toBe("in_progress");
  });

  it("närvaro behöver åtgärd efter passerad aktivitet utan rader", () => {
    const steps = stepStatuses(
      snap({ startsAt: "2026-09-01T16:00:00Z", endsAt: "2026-09-01T17:30:00Z" }),
    );
    expect(steps.attendance).toBe("needs_action");
  });

  it("närvaro är klar när alla har status", () => {
    const steps = stepStatuses(
      snap({
        startsAt: "2026-09-01T16:00:00Z",
        endsAt: "2026-09-01T17:30:00Z",
        attendanceCount: 12,
      }),
    );
    expect(steps.attendance).toBe("done");
  });

  it("inställd aktivitet gör stegen ej aktuella", () => {
    const steps = stepStatuses(snap({ cancelledAt: "2026-09-02T10:00:00Z" }));
    expect(steps.invitation).toBe("not_applicable");
    expect(steps.planning).toBe("not_applicable");
    expect(steps.attendance).toBe("not_applicable");
  });

  it("uppgifter behöver åtgärd när plats saknas", () => {
    expect(stepStatuses(snap({ hasLocation: false })).details).toBe("needs_action");
  });
});

describe("coachPrimaryAction", () => {
  it("prioriterar väntande medlemmar före kallelse", () => {
    expect(coachPrimaryAction(snap({ pendingMembers: 2, invitationCount: 0 }))).toBe(
      "manage_members",
    );
  });

  it("föreslår att skapa kallelse när den saknas", () => {
    expect(coachPrimaryAction(snap({ invitationCount: 0 }))).toBe("create_invitation");
  });

  it("föreslår påminnelse nära aktiviteten", () => {
    expect(
      coachPrimaryAction(snap({ startsAt: "2026-09-04T16:00:00Z", pendingResponses: 4 })),
    ).toBe("remind_pending");
  });

  it("föreslår planering när den inte är klar", () => {
    expect(coachPrimaryAction(snap({ planDone: false }))).toBe("continue_planning");
  });

  it("föreslår att starta och fortsätta träningen", () => {
    const ongoing = {
      type: "training",
      startsAt: "2026-09-03T11:30:00Z",
      endsAt: "2026-09-03T13:00:00Z",
    };
    expect(coachPrimaryAction(snap(ongoing))).toBe("start_session");
    expect(coachPrimaryAction(snap({ ...ongoing, runActive: true }))).toBe("continue_session");
  });

  it("ger aldrig kallelse som nästa steg för en träning", () => {
    expect(coachPrimaryAction(snap({ type: "training", invitationCount: 0 }))).not.toBe(
      "create_invitation",
    );
    expect(stepStatuses(snap({ type: "training" })).invitation).toBe("not_applicable");
  });

  it("föreslår närvaro och därefter sammanfattning", () => {
    const past = { startsAt: "2026-09-01T16:00:00Z", endsAt: "2026-09-01T17:30:00Z" };
    expect(coachPrimaryAction(snap(past))).toBe("register_attendance");
    expect(coachPrimaryAction(snap({ ...past, attendanceCount: 12, hasFollowup: true }))).toBe(
      "show_summary",
    );
  });

  it("ger ingen handling för inställd aktivitet", () => {
    expect(coachPrimaryAction(snap({ cancelledAt: "2026-09-02T10:00:00Z" }))).toBe("none");
  });
});

describe("memberPrimaryAction", () => {
  const base = {
    now: NOW,
    startsAt: "2026-09-10T16:00:00Z",
    endsAt: "2026-09-10T17:30:00Z",
    cancelledAt: null,
    hasPendingResponse: false,
    hasUnreadMessage: false,
  };

  it("svara på kallelsen går först", () => {
    expect(memberPrimaryAction({ ...base, hasPendingResponse: true, hasUnreadMessage: true })).toBe(
      "respond_invitation",
    );
  });

  it("läs meddelandet när svaret finns", () => {
    expect(memberPrimaryAction({ ...base, hasUnreadMessage: true })).toBe("read_message");
  });

  it("visa aktivitet i övrigt", () => {
    expect(memberPrimaryAction(base)).toBe("show_event");
  });

  it("inställd aktivitet ger tydlig status utan åtgärd", () => {
    expect(memberPrimaryAction({ ...base, cancelledAt: "2026-09-02T10:00:00Z" })).toBe("cancelled");
  });
});
