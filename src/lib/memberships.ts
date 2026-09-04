export type MembershipRole = "coach" | "head_coach" | "club_admin" | "player" | "guardian";

export type MembershipLike = {
  id: string;
  team_id: string;
  role: MembershipRole;
  status: "pending" | "approved";
  team?: { id: string; name: string; age_group: string | null; gender: string } | null;
};

export const MEMBERSHIP_ROLE_LABELS: Record<MembershipRole, string> = {
  coach: "Tränare",
  head_coach: "Huvudtränare",
  club_admin: "Klubbadmin",
  player: "Spelare",
  guardian: "Vårdnadshavare",
};

export type TeamMembershipGroup = {
  team_id: string;
  team: MembershipLike["team"];
  roles: MembershipRole[];
  memberships: MembershipLike[];
};

/**
 * Slår ihop medlemskap per lag så att ett lag bara visas en gång även när
 * användaren har flera roller (till exempel både tränare och vårdnadshavare).
 */
export function groupMembershipsByTeam<T extends MembershipLike>(
  memberships: readonly T[],
): TeamMembershipGroup[] {
  const groups = new Map<string, TeamMembershipGroup>();
  for (const membership of memberships) {
    const existing = groups.get(membership.team_id);
    if (existing) {
      if (!existing.roles.includes(membership.role)) existing.roles.push(membership.role);
      existing.memberships.push(membership);
      if (!existing.team && membership.team) existing.team = membership.team;
      continue;
    }
    groups.set(membership.team_id, {
      team_id: membership.team_id,
      team: membership.team ?? null,
      roles: [membership.role],
      memberships: [membership],
    });
  }
  return [...groups.values()];
}

export function membershipRoleLabels(roles: readonly MembershipRole[]): string[] {
  return roles.map((role) => MEMBERSHIP_ROLE_LABELS[role]);
}
