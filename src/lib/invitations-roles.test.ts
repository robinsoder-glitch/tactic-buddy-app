import { describe, expect, it } from "vitest";
import {
  canRespondAsGuardian,
  canRespondSelf,
  countInvitations,
  reminderResultText,
  summaryText,
  type Invitation,
} from "./invitations";
import { canGuardianRespond } from "./guardians";
import { isLeaderRole, isGuardianRole, teamRoleName } from "./team-roles";
import { teamAccess } from "./permissions";

function invite(partial: Partial<Invitation>): Invitation {
  return {
    id: "i1",
    event_id: "e1",
    team_id: "t1",
    player_id: "p1",
    status: "pending",
    comment: null,
    respond_by: null,
    message: null,
    responded_by: null,
    responded_at: null,
    last_reminder_at: null,
    created_at: "",
    updated_at: "",
    ...partial,
  } as Invitation;
}

describe("roller per lag", () => {
  it("ledarroller ger ledarbehörighet", () => {
    expect(isLeaderRole("club_admin")).toBe(true);
    expect(isLeaderRole("head_coach")).toBe(true);
    expect(isLeaderRole("coach")).toBe(true);
    expect(isLeaderRole("guardian")).toBe(false);
    expect(isLeaderRole("player")).toBe(false);
  });

  it("vårdnadshavare är egen roll med svenskt namn", () => {
    expect(isGuardianRole("guardian")).toBe(true);
    expect(teamRoleName("head_coach")).toBe("Huvudtränare");
  });

  it("huvudtränare får ledaråtkomst i teamAccess", () => {
    const access = teamAccess({
      userId: "u1",
      isAdmin: false,
      isOwner: false,
      membership: { role: "head_coach", status: "approved" },
    });
    expect(access.isCoach).toBe(true);
  });

  it("vårdnadshavare får inte ledaråtkomst", () => {
    const access = teamAccess({
      userId: "u1",
      isAdmin: false,
      isOwner: false,
      membership: { role: "guardian", status: "approved" },
    });
    expect(access.isCoach).toBe(false);
    expect(access.isGuardian).toBe(true);
  });
});

describe("vårdnadshavare svarar", () => {
  it("får svara för kopplat barn", () => {
    expect(canRespondAsGuardian(invite({ player_id: "p1" }), ["p1", "p2"])).toBe(true);
    expect(canGuardianRespond({ playerId: "p1", guardedPlayerIds: ["p1"] })).toBe(true);
  });

  it("får inte svara för andras barn", () => {
    expect(canRespondAsGuardian(invite({ player_id: "p9" }), ["p1"])).toBe(false);
  });

  it("spelaren själv svarar via kopplat konto", () => {
    expect(canRespondSelf({ memberUserId: "u1" } as Invitation, "u1")).toBe(true);
    expect(canRespondSelf({ memberUserId: "u2" } as Invitation, "u1")).toBe(false);
  });
});

describe("summering och påminnelser", () => {
  it("summerar i klartext", () => {
    const counts = countInvitations([
      ...Array.from({ length: 12 }, () => ({ status: "attending" })),
      ...Array.from({ length: 2 }, () => ({ status: "maybe" })),
      { status: "declined" },
      ...Array.from({ length: 3 }, () => ({ status: "pending" })),
    ]);
    expect(summaryText(counts)).toBe("12 kommer · 2 kanske · 1 kan inte · 3 ej svarat");
    expect(counts.total).toBe(18);
  });

  it("ändrat svar uppdaterar summeringen direkt", () => {
    const before = countInvitations([{ status: "pending" }, { status: "attending" }]);
    const after = countInvitations([{ status: "attending" }, { status: "attending" }]);
    expect(before.pending).toBe(1);
    expect(after.pending).toBe(0);
    expect(after.attending).toBe(2);
  });

  it("berättar ärligt när inget skickades", () => {
    expect(reminderResultText({ sent: 0, skippedRecent: 3, missingAccount: 0 })).toContain(
      "redan en påminnelse nyss",
    );
    expect(reminderResultText({ sent: 0, skippedRecent: 0, missingAccount: 2 })).toContain(
      "Ingen påminnelse kunde skapas",
    );
  });

  it("anger att e-post och push inte är aktiverat", () => {
    const text = reminderResultText({ sent: 4, skippedRecent: 0, missingAccount: 1 });
    expect(text).toContain("Påminnelse i appen skickad till 4 mottagare.");
    expect(text).toContain("E-post och push är inte aktiverat");
  });
});
