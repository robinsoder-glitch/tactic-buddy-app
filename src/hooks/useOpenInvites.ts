import { useQuery } from "@tanstack/react-query";
import { fetchMyInvitations } from "@/lib/invitations";
import { useAccount } from "./useAccount";

/** Antal kommande matcher där jag ännu inte svarat – visas som röd siffra på fliken. */
export function countOpenInvites(
  list: Array<{ status: string; event: { starts_at: string; cancelled_at: string | null } }>,
  now = new Date(),
): number {
  return list.filter(
    (item) =>
      item.status === "pending" &&
      !item.event.cancelled_at &&
      new Date(item.event.starts_at).getTime() >= now.getTime(),
  ).length;
}

export function useOpenInvites(): number {
  const { userId, isCoach, isAdmin } = useAccount();
  const invites = useQuery({
    queryKey: ["my-invitations-count", userId],
    queryFn: fetchMyInvitations,
    enabled: !!userId && !isCoach && !isAdmin,
    refetchInterval: 60000,
  });
  return countOpenInvites(invites.data ?? []);
}
