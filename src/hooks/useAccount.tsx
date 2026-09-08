import { useQuery } from "@tanstack/react-query";
import { fetchMyRoles, fetchMyMemberships, fetchProfile } from "@/lib/teams";
import { isLeaderRole } from "@/lib/team-roles";
import { useAuth } from "./useAuth";

export function useAccount() {
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  // Behörighet ändras sällan under en session. Vi hämtar den en gång och
  // låter den ligga kvar tills något faktiskt ändras (in-/utloggning eller
  // en ändring i laget som gör invalidate på nycklarna nedan).
  const ACCOUNT_STALE_TIME = 15 * 60_000;

  const roles = useQuery({
    queryKey: ["roles", userId],
    queryFn: fetchMyRoles,
    enabled: !!userId,
    staleTime: ACCOUNT_STALE_TIME,
  });

  const memberships = useQuery({
    queryKey: ["memberships", userId],
    queryFn: fetchMyMemberships,
    enabled: !!userId,
    staleTime: ACCOUNT_STALE_TIME,
  });

  const profile = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId as string),
    enabled: !!userId,
    staleTime: ACCOUNT_STALE_TIME,
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

  // Kom igång-sidan ska bara visas för den som varken valt kontotyp, har en
  // roll eller är med i ett lag. Annars fastnar t.ex. en ny tränare som redan
  // skapat sitt lag i valet av kontotyp.
  const needsOnboarding =
    roleList.length === 0 && membershipList.length === 0 && !accountKind;

  return {
    user,
    userId,
    profile: profile.data ?? null,
    roles: roleList,
    accountKind: accountKind ?? null,
    needsOnboarding,
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

