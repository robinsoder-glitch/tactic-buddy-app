import { describe, expect, it } from "vitest";
import {
  ANSWER_STATUSES,
  INVITE_STATUS_LABELS,
  LATE_RESPONSE_TEXT,
  RESPOND_BY_STATE_LABELS,
  activeInvitations,
  canPublishInvitations,
  canRecipientAnswer,
  canRemind,
  countInvitations,
  formatRespondByDate,
  inviteStatusLabel,
  isCoachMembership,
  isLateResponse,
  playerInviteStatus,
  playerReach,
  publishButtonLabel,
  publishResultText,
  respondByState,
  respondByText,
  respondedByText,
  revokedText,
  suggestRespondBy,
  summarizeReach,
} from "./invite-status";

describe("statusar", () => {
  it("kallar spelare utan kallelse för Ej kallad", () => {
    const list = [
      { player_id: "p1", status: "attending" },
      { player_id: "p2", status: "revoked" },
    ];
    expect(playerInviteStatus("p3", list)).toBe("not_invited");
    expect(playerInviteStatus("p2", list)).toBe("revoked");
    expect(playerInviteStatus("p1", list)).toBe("attending");
    expect(INVITE_STATUS_LABELS.not_invited).toBe("Ej kallad");
    expect(inviteStatusLabel("revoked")).toBe("Återkallad");
  });

  it("låter bara riktiga svar väljas", () => {
    expect(ANSWER_STATUSES).toEqual(["attending", "maybe", "declined"]);
  });

  it("räknar bara aktiva kallelser i totalen", () => {
    const list = [
      { status: "attending" },
      { status: "pending" },
      { status: "revoked" },
      { status: "revoked" },
    ];
    expect(activeInvitations(list)).toHaveLength(2);
    const counts = countInvitations(list);
    expect(counts.total).toBe(2);
    expect(counts.revoked).toBe(2);
    expect(counts.pending).toBe(1);
  });
});

describe("nåbarhet", () => {
  const withAccount = { id: "1", member_user_id: "user-1", hasActiveGuardian: false };
  const withGuardian = { id: "2", member_user_id: null, hasActiveGuardian: true };
  const alone = { id: "3", member_user_id: null, hasActiveGuardian: false };

  it("väljer eget konto före vårdnadshavare", () => {
    expect(playerReach({ ...withAccount, hasActiveGuardian: true })).toBe("account");
    expect(playerReach(withGuardian)).toBe("guardian");
    expect(playerReach(alone)).toBe("none");
  });

  it("summerar och beskriver publiceringen ärligt", () => {
    const summary = summarizeReach([withAccount, withGuardian, alone]);
    expect(summary).toEqual({ selected: 3, account: 1, guardian: 1, none: 1 });
    const text = publishResultText(summary);
    expect(text).toContain("3");
    expect(text.toLowerCase()).toContain("vårdnadshavare");
    expect(publishButtonLabel(3)).toContain("3");
  });
});

describe("sista svarsdag", () => {
  const now = Date.parse("2026-05-10T09:00:00");

  it("känner av öppet, snart, passerat och stängt", () => {
    expect(respondByState({ respondBy: null, now })).toBe("none");
    expect(respondByState({ respondBy: "2026-05-20", now })).toBe("open");
    expect(respondByState({ respondBy: "2026-05-11", now })).toBe("soon");
    expect(respondByState({ respondBy: "2026-05-01", now })).toBe("passed");
    expect(respondByState({ respondBy: "2026-05-20", now, closed: true })).toBe("closed");
    expect(RESPOND_BY_STATE_LABELS.passed).toBeTruthy();
  });

  it("skriver datum på svenska", () => {
    expect(formatRespondByDate("2026-05-20")).toMatch(/20/);
    expect(respondByText(null).toLowerCase()).toContain("sista svarsdag");
  });

  it("föreslår sju dagar före matchen, annars dagen före", () => {
    expect(suggestRespondBy("2026-06-01T18:00:00Z", now)).toBe("2026-05-25");
    expect(suggestRespondBy("2026-05-12T18:00:00Z", now)).toBe("2026-05-11");
    expect(suggestRespondBy(null, now)).toBe("");
  });

  it("markerar sena svar", () => {
    expect(isLateResponse("2026-05-21T10:00:00", "2026-05-20")).toBe(true);
    expect(isLateResponse("2026-05-19T10:00:00", "2026-05-20")).toBe(false);
    expect(isLateResponse(null, "2026-05-20")).toBe(false);
    expect(LATE_RESPONSE_TEXT).toBeTruthy();
  });
});

describe("spärrar", () => {
  const now = Date.parse("2026-05-10T09:00:00");
  const future = "2026-05-20T18:00:00";
  const past = "2026-05-01T18:00:00";

  it("stoppar publicering för inställd eller redan spelad match", () => {
    expect(canPublishInvitations({ cancelled: true, startsAt: future, now }).ok).toBe(false);
    expect(canPublishInvitations({ cancelled: false, startsAt: past, now }).ok).toBe(false);
    expect(canPublishInvitations({ cancelled: false, startsAt: future, now }).ok).toBe(true);
  });

  it("stoppar påminnelser utan obesvarade", () => {
    expect(canRemind({ cancelled: false, startsAt: future, pendingCount: 0, now }).ok).toBe(false);
    expect(canRemind({ cancelled: false, startsAt: future, pendingCount: 2, now }).ok).toBe(true);
    expect(canRemind({ cancelled: false, startsAt: past, pendingCount: 2, now }).ok).toBe(false);
  });

  it("stoppar svar när kallelsen är stängd, återkallad eller inställd", () => {
    expect(canRecipientAnswer({ status: "pending", cancelled: false }).ok).toBe(true);
    expect(canRecipientAnswer({ status: "revoked", cancelled: false }).ok).toBe(false);
    expect(
      canRecipientAnswer({ status: "pending", cancelled: false, invitesClosed: true }).ok,
    ).toBe(false);
    expect(canRecipientAnswer({ status: "pending", cancelled: true }).ok).toBe(false);
  });
});

describe("texter om vem som gjorde vad", () => {
  it("visar roll och namn", () => {
    expect(respondedByText({ role: "coach", name: "Anna" })).toContain("ledare");
    expect(respondedByText({ role: "guardian", name: "Bo" })).toContain("vårdnadshavare");
    expect(respondedByText({})).toBe("");
    expect(revokedText({ name: "Anna", at: "2026-05-10T10:00:00" })).toContain("Anna");
  });

  it("räknar bara ledarroller som tränarlag", () => {
    expect(isCoachMembership({ role: "coach", status: "approved" })).toBe(true);
    expect(isCoachMembership({ role: "player", status: "approved" })).toBe(false);
    expect(isCoachMembership({ role: "coach", status: "pending" })).toBe(false);
  });
});
