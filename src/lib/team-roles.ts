/**
 * Roller är kopplade till medlemskapet i ett visst lag. Samma användare kan
 * därför ha olika roller i olika lag. Databasen (RLS) är den verkliga spärren.
 */

export const TEAM_ROLES = ["club_admin", "head_coach", "coach", "guardian", "player"] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export const TEAM_ROLE_NAMES: Record<TeamRole, string> = {
  club_admin: "Klubbadmin",
  head_coach: "Huvudtränare",
  coach: "Tränare",
  guardian: "Vårdnadshavare",
  player: "Spelare",
};

const LEADER_ROLES: TeamRole[] = ["club_admin", "head_coach", "coach"];

export function isTeamRole(value: string | null | undefined): value is TeamRole {
  return TEAM_ROLES.includes(value as TeamRole);
}

/** Klubbadmin, huvudtränare och tränare räknas som ledare i laget. */
export function isLeaderRole(role: string | null | undefined): boolean {
  return isTeamRole(role) && LEADER_ROLES.includes(role);
}

export function isGuardianRole(role: string | null | undefined): boolean {
  return role === "guardian";
}

export function teamRoleName(role: string | null | undefined): string {
  return isTeamRole(role) ? TEAM_ROLE_NAMES[role] : "Medlem";
}
