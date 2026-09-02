/**
 * Behörighetsregler för lag. Rena funktioner så att de kan testas och
 * användas både i UI och i tester. Databasen (RLS) är den verkliga spärren –
 * det här styr vad som visas och vilka handlingar som erbjuds.
 */

export type TeamRoleName = "owner" | "coach" | "player" | "member";

export const TEAM_ROLE_LABELS: Record<TeamRoleName, string> = {
  owner: "Lagägare",
  coach: "Ledare",
  player: "Spelare",
  member: "Medlem/vårdnadshavare",
};

export const TEAM_ROLE_DESCRIPTIONS: Record<TeamRoleName, string> = {
  owner: "Skapade laget. Hanterar ledare, laginställningar, arkivering och radering.",
  coach: "Hanterar trupp, kalender, närvaro och statistik.",
  player: "Ser trupp, kalender och aktiviteter. Kan inte ändra något.",
  member: "Vårdnadshavare eller annan medlem med läsbehörighet efter godkännande.",
};

export type TeamMembershipInfo = {
  role: "coach" | "player";
  status: "pending" | "approved";
  /** Lagledare kan få särskild behörighet att registrera närvaro. */
  canManageAttendance?: boolean;
} | null;

export type TeamAccessInput = {
  userId: string | null;
  isAdmin: boolean;
  /** teams.created_by === userId */
  isOwner: boolean;
  membership: TeamMembershipInfo;
};

export type TeamAccess = {
  isOwner: boolean;
  isCoach: boolean;
  isApproved: boolean;
  isPending: boolean;
  canManageSquad: boolean;
  canEditSettings: boolean;
  canManageLeaders: boolean;
  canInviteLeaders: boolean;
  canArchiveTeam: boolean;
  canDeleteTeam: boolean;
  canViewAttendance: boolean;
  canManageAttendance: boolean;
  canViewStats: boolean;
};

export function teamAccess(input: TeamAccessInput): TeamAccess {
  const signedIn = Boolean(input.userId);
  const approvedMember = input.membership?.status === "approved";
  const isOwner = signedIn && input.isOwner;
  const isCoach = signedIn && (isOwner || input.isAdmin || (approvedMember && input.membership?.role === "coach"));
  const isApproved = signedIn && (isOwner || input.isAdmin || approvedMember);

  return {
    isOwner,
    isCoach,
    isApproved,
    isPending: input.membership?.status === "pending" && !isOwner,
    canManageSquad: isCoach,
    canEditSettings: isCoach,
    canManageLeaders: isOwner || input.isAdmin,
    canInviteLeaders: isOwner || input.isAdmin,
    canArchiveTeam: isOwner || input.isAdmin,
    canDeleteTeam: isOwner || input.isAdmin,
    canViewAttendance: isCoach || (approvedMember && Boolean(input.membership?.canManageAttendance)),
    canManageAttendance: isCoach || (approvedMember && Boolean(input.membership?.canManageAttendance)),
    canViewStats: isCoach,
  };
}

/** En lagkod ger aldrig ledarbehörighet – bara en ansökan om medlemskap. */
export function joinCodeGrant(): { role: "player"; status: "pending" } {
  return { role: "player", status: "pending" };
}

/** Lagägaren kan bara tas bort som ledare om någon annan är lagägare. */
export function canRemoveLeader(input: {
  actor: TeamAccess;
  targetUserId: string;
  ownerUserId: string | null;
  actorUserId: string | null;
}): boolean {
  if (!input.actor.canManageLeaders) return false;
  if (input.targetUserId === input.ownerUserId) return false;
  if (input.targetUserId === input.actorUserId) return false;
  return true;
}
