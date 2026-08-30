import { useAccount } from "./useAccount";

export function useTeamRole(teamId: string) {
  const { memberships, userId, isAdmin, loading } = useAccount();
  const membership = memberships.find((item) => item.team_id === teamId);
  return {
    userId,
    loading,
    isAdmin,
    isCoach: membership?.role === "coach" && membership.status === "approved",
    isApproved: membership?.status === "approved" || isAdmin,
    status: membership?.status ?? null,
  };
}
