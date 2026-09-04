import { describe, expect, it } from "vitest";
import { groupMembershipsByTeam, membershipRoleLabels } from "./memberships";

const team = { id: "t1", name: "P12", age_group: null, gender: "boys" };

describe("groupMembershipsByTeam", () => {
  it("slår ihop flera roller i samma lag till ett kort", () => {
    const groups = groupMembershipsByTeam([
      { id: "m1", team_id: "t1", role: "coach", status: "approved", team },
      { id: "m2", team_id: "t1", role: "guardian", status: "approved", team },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.roles).toEqual(["coach", "guardian"]);
    expect(membershipRoleLabels(groups[0]!.roles)).toEqual(["Tränare", "Vårdnadshavare"]);
  });

  it("behåller olika lag var för sig", () => {
    const groups = groupMembershipsByTeam([
      { id: "m1", team_id: "t1", role: "coach", status: "approved", team },
      { id: "m2", team_id: "t2", role: "player", status: "approved", team: null },
    ]);
    expect(groups.map((group) => group.team_id)).toEqual(["t1", "t2"]);
  });

  it("dubblerar inte samma roll", () => {
    const groups = groupMembershipsByTeam([
      { id: "m1", team_id: "t1", role: "coach", status: "approved", team },
      { id: "m2", team_id: "t1", role: "coach", status: "approved", team },
    ]);
    expect(groups[0]!.roles).toEqual(["coach"]);
    expect(groups[0]!.memberships).toHaveLength(2);
  });
});
