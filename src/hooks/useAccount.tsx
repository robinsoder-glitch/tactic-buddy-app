import { useQuery } from "@tanstack/react-query";
import { fetchMyRoles, fetchMyMemberships, fetchProfile } from "@/lib/teams";
import { isLeaderRole } from "@/lib/team-roles";
import { useAuth } from "./useAuth";

export function useAccount() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  const roles = useQuery({
    queryKey: ["roles", userId],
    queryFn: fetchMyRoles,
    enabled: !!userId,
  });

  const memberships = useQuery({
    queryKey: ["memberships", userId],
    queryFn: fetchMyMemberships,
    enabled: !!userId,
  });

  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId as string),
    enabled: !!userId,
  });

  const roleList = roles.data ?? [];
  const membershipList = memberships.data ?? [];
  const accountKind = (profile.data as { account_kind?: string | null } | null)?.account_kind;

  // Behörighet kommer från medlemskapet i laget. Kontotypen på profilen styr
  // bara vad som visas, t.ex. att en ny tränare kan skapa sitt första lag.
  const hasLeaderMembership = membershipList.some((item) => isLeaderRole(item.role));
  const hasPlayerMembership = membershipList.some(
    (item) => item.role === "player" || item.role === "guardian",
  );

  return {
    user,
    userId,
    profile: profile.data ?? null,
    roles: roleList,
    isAdmin: roleList.includes("admin"),
    isCoach: accountKind === "coach" || hasLeaderMembership || roleList.includes("coach"),
    isPlayer:
      accountKind === "player" ||
      accountKind === "guardian" ||
      hasPlayerMembership ||
      roleList.includes("player"),
    memberships: membershipList,
    loading: loading || roles.isLoading || memberships.isLoading || profile.isLoading,
  };
}
