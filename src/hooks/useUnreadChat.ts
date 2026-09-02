import { useQuery } from "@tanstack/react-query";
import { fetchUnreadChatCount } from "@/lib/team-chat";
import { useAccount } from "./useAccount";

/** Antal olästa meddelanden i Tränarsnack för de lag man är ledare i. */
export function useUnreadChat(): number {
  const { memberships, userId } = useAccount();
  const teamIds = memberships
    .filter((item) => item.status === "approved" && item.role === "coach")
    .map((item) => item.team_id);

  const unread = useQuery({
    queryKey: ["team-chat-unread", teamIds.join(","), userId],
    queryFn: () => fetchUnreadChatCount(teamIds, userId),
    enabled: teamIds.length > 0,
    refetchInterval: 30000,
  });

  return unread.data ?? 0;
}
