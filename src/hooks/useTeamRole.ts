import { useQuery } from "@tanstack/react-query";
import { fetchTeam } from "@/lib/teams";
import { teamAccess } from "@/lib/permissions";
import { useAccount } from "./useAccount";

export function useTeamRole(teamId: string) {
  const { memberships, userId, isAdmin, loading } = useAccount();
  const team = useQuery({
    queryKey: ["team", teamId],
    queryFn: () => fetchTeam(teamId),
    enabled: !!teamId,
  });
  const membership = memberships.find((item) => item.team_id === teamId);
  const isOwner = Boolean(userId && team.data?.created_by === userId);

  const access = teamAccess({
    userId,
    isAdmin,
    isOwner,
    membership: membership
      ? {
          role: membership.role,
          status: membership.status,
          canManageAttendance: Boolean(
            (membership as { can_manage_attendance?: boolean }).can_manage_attendance,
          ),
        }
      : null,
  });

  return {
    userId,
    loading: loading || team.isLoading,
    isAdmin,
    ownerId: team.data?.created_by ?? null,
    ...access,
    status: membership?.status ?? (isOwner ? "approved" : null),
  };
}
