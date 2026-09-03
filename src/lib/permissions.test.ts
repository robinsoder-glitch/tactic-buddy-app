import { describe, expect, it } from "vitest";
import { canRemoveLeader, joinCodeGrant, teamAccess } from "./permissions";
import { birthLabel, birthYearOf, hasExactBirthDate, toStoredBirth } from "./player-privacy";
import { friendlyError, looksTechnical } from "./user-errors";

const base = { userId: "u1", isAdmin: false, isOwner: false, membership: null } as const;

describe("teamAccess", () => {
  it("utomstående får ingen åtkomst", () => {
    const access = teamAccess({ ...base });
    expect(access.isApproved).toBe(false);
    expect(access.canManageSquad).toBe(false);
    expect(access.canViewAttendance).toBe(false);
    expect(access.canViewStats).toBe(false);
  });

  it("spelare kan inte ändra laginställningar eller se närvaro", () => {
    const access = teamAccess({ ...base, membership: { role: "player", status: "approved" } });
    expect(access.isApproved).toBe(true);
    expect(access.canEditSettings).toBe(false);
    expect(access.canManageSquad).toBe(false);
    expect(access.canViewAttendance).toBe(false);
    expect(access.canViewStats).toBe(false);
    expect(access.canDeleteTeam).toBe(false);
    expect(access.canManageLeaders).toBe(false);
  });

  it("väntande medlem är inte godkänd", () => {
    const access = teamAccess({ ...base, membership: { role: "player", status: "pending" } });
    expect(access.isPending).toBe(true);
    expect(access.isApproved).toBe(false);
  });

  it("ledare hanterar trupp, närvaro och statistik men inte radering", () => {
    const access = teamAccess({ ...base, membership: { role: "coach", status: "approved" } });
    expect(access.isCoach).toBe(true);
    expect(access.canManageSquad).toBe(true);
    expect(access.canViewAttendance).toBe(true);
    expect(access.canViewStats).toBe(true);
    expect(access.canDeleteTeam).toBe(false);
    expect(access.canInviteLeaders).toBe(false);
  });

  it("lagägaren är alltid ledare och kan radera laget", () => {
    const access = teamAccess({ ...base, isOwner: true, membership: null });
    expect(access.isCoach).toBe(true);
    expect(access.isApproved).toBe(true);
    expect(access.canDeleteTeam).toBe(true);
    expect(access.canArchiveTeam).toBe(true);
    expect(access.canInviteLeaders).toBe(true);
  });

  it("utloggad användare får inget", () => {
    const access = teamAccess({ userId: null, isAdmin: false, isOwner: true, membership: null });
    expect(access.isCoach).toBe(false);
    expect(access.isApproved).toBe(false);
  });
});

describe("lagkod", () => {
  it("ger aldrig ledarbehörighet", () => {
    expect(joinCodeGrant()).toEqual({ role: "player", status: "pending" });
  });
});

describe("canRemoveLeader", () => {
  const owner = teamAccess({ ...base, isOwner: true });
  const coach = teamAccess({ ...base, membership: { role: "coach", status: "approved" } });

  it("lagägaren kan inte tas bort", () => {
    expect(
      canRemoveLeader({ actor: owner, targetUserId: "u1", ownerUserId: "u1", actorUserId: "u1" }),
    ).toBe(false);
  });
  it("ledare kan inte ta bort andra ledare", () => {
    expect(
      canRemoveLeader({ actor: coach, targetUserId: "u2", ownerUserId: "u9", actorUserId: "u1" }),
    ).toBe(false);
  });
  it("lagägaren kan ta bort en annan ledare", () => {
    expect(
      canRemoveLeader({ actor: owner, targetUserId: "u2", ownerUserId: "u1", actorUserId: "u1" }),
    ).toBe(true);
  });
});

describe("dataminimering för spelare", () => {
  it("sparar födelseår som årets första dag", () => {
    expect(toStoredBirth({ year: "2018" })).toBe("2018-01-01");
  });
  it("tillåter tomt", () => {
    expect(toStoredBirth({ year: "" })).toBeNull();
    expect(toStoredBirth({ year: "18" })).toBeNull();
  });
  it("behåller exakt datum bara när det valts", () => {
    expect(toStoredBirth({ year: "2018", exactDate: "2018-05-04", useExact: true })).toBe(
      "2018-05-04",
    );
    expect(toStoredBirth({ year: "2018", exactDate: "2018-05-04", useExact: false })).toBe(
      "2018-01-01",
    );
  });
  it("känner igen år kontra datum", () => {
    expect(hasExactBirthDate("2018-01-01")).toBe(false);
    expect(hasExactBirthDate("2018-05-04")).toBe(true);
    expect(birthYearOf("2018-05-04")).toBe("2018");
    expect(birthLabel("2018-01-01")).toBe("Födelseår 2018");
  });
});

describe("friendlyError", () => {
  it("döljer databasfel", () => {
    expect(
      friendlyError(new Error('new row violates row-level security policy for table "teams"')),
    ).toBe("Du har inte behörighet till det här.");
  });
  it("döljer stack traces och id", () => {
    expect(friendlyError(new Error("TypeError: undefined at Foo (http://x/y.js:1:1)"))).toBe(
      "Något gick fel. Försök igen.",
    );
  });
  it("behåller våra egna svenska meddelanden", () => {
    expect(friendlyError(new Error("Ange en giltig e-postadress"))).toBe(
      "Ange en giltig e-postadress",
    );
  });
  it("flaggar teknisk text", () => {
    expect(looksTechnical("null")).toBe(true);
    expect(looksTechnical("Ange ett namn")).toBe(false);
  });
});
