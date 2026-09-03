import { useQuery } from "@tanstack/react-query";
import { countUnreadInbox, fetchInbox } from "@/lib/announcements";
import { useAccount } from "./useAccount";

/** Antal olästa viktiga meddelanden – visas som röd siffra i menyn. */
export function useUnreadInbox(): number {
  const { userId } = useAccount();
  const inbox = useQuery({
    queryKey: ["announcement-unread", userId],
    queryFn: fetchInbox,
    enabled: !!userId,
    refetchInterval: 60000,
  });
  return countUnreadInbox(inbox.data ?? []);
}
