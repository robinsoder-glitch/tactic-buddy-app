import { useQuery } from "@tanstack/react-query";
import { canRespondAsGuardian, canRespondSelf, fetchMyInvitations } from "@/lib/invitations";
import { fetchMyGuardedPlayerIds } from "@/lib/guardians";
import { useAccount } from "./useAccount";

type CountableInvite = {
  status: string;
  memberUserId?: string | null;
  player_id?: string;
  event: {
    starts_at: string;
    cancelled_at: string | null;
    invites_closed_at?: string | null;
  };
};

/**
 * Antal kommande matcher där ett svar faktiskt är möjligt – visas som röd
 * siffra på fliken. Räknaren följer relationen till spelaren, inte en global
 * tränarroll: en tränare som också är vårdnadshavare ska se sina barns
 * obesvarade kallelser. Inställda och stängda kallelser räknas inte, eftersom
 * de inte går att svara på.
 */
export function countOpenInvites(
  list: CountableInvite[],
  now = new Date(),
  who: { userId?: string | null; guardedPlayerIds?: string[] } = {},
): number {
  const guarded = who.guardedPlayerIds ?? [];
  const scoped = who.userId !== undefined || who.guardedPlayerIds !== undefined;
  return list.filter((item) => {
    if (item.status !== "pending") return false;
    if (item.event.cancelled_at) return false;
    if (item.event.invites_closed_at) return false;
    if (new Date(item.event.starts_at).getTime() < now.getTime()) return false;
    if (!scoped) return true;
    return (
      canRespondSelf({ memberUserId: item.memberUserId ?? null }, who.userId ?? null) ||
      canRespondAsGuardian({ player_id: item.player_id ?? "" }, guarded)
    );
  }).length;
}

export function useOpenInvites(): number {
  const { userId } = useAccount();

  const invites = useQuery({
    queryKey: ["my-invitations-count", userId],
    queryFn: fetchMyInvitations,
    enabled: !!userId,
    refetchInterval: 60000,
  });

  const guarded = useQuery({
    queryKey: ["guarded-players", userId],
    queryFn: () => fetchMyGuardedPlayerIds(userId),
    enabled: !!userId,
  });

  return countOpenInvites(invites.data ?? [], new Date(), {
    userId,
    guardedPlayerIds: guarded.data ?? [],
  });
}
