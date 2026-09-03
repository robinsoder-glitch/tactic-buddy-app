import { useQuery } from "@tanstack/react-query";
import { fetchPendingJoinCounts } from "@/lib/teams";
import { useAccount } from "./useAccount";

const LEADER_ROLES = ["coach", "head_coach", "club_admin"];

/**
 * Nya medlemsansökningar i de lag man är ledare för. Används för den röda
 * siffran i menyn så att tränaren ser när någon vill gå med.
 */
export function usePendingJoins(): { total: number; byTeam: Record<string, number> } {
  const { memberships, userId } = useAccount();
  const teamIds = memberships
    .filter((item) => item.status === "approved" && LEADER_ROLES.includes(item.role))
    .map((item) => item.team_id);

  const pending = useQuery({
    queryKey: ["pending-joins", teamIds.slice().sort().join(","), userId],
    queryFn: () => fetchPendingJoinCounts(teamIds),
    enabled: teamIds.length > 0,
    refetchInterval: 60000,
  });

  const byTeam = pending.data ?? {};
  const total = Object.values(byTeam).reduce((sum, value) => sum + value, 0);
  return { total, byTeam };
}
