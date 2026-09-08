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
  // Ledaruppgifter kräver ett godkänt ledarmedlemskap – en väntande ansökan
  // ger inga ledarrättigheter.
  const hasLeaderMembership = membershipList.some(
    (item) => isLeaderRole(item.role) && item.status === "approved",
  );
  const hasPlayerMembership = membershipList.some(
    (item) => item.role === "player" || item.role === "guardian",
  );

  // Kom igång-sidan ska bara visas för den som varken valt kontotyp, har en
  // roll eller är med i ett lag – och bara när vi faktiskt har hämtat allt.
  // Annars kan ett tillfälligt fel eller en långsam hämtning kasta tillbaka
  // en tränare som redan skapat sitt lag till "skapa"-läget.
  const accountReady = roles.isSuccess && memberships.isSuccess && profile.isSuccess;
  const needsOnboarding =
    accountReady && roleList.length === 0 && membershipList.length === 0 && !accountKind;

  return {
    user,
    userId,
    profile: profile.data ?? null,
    roles: roleList,
    accountKind: accountKind ?? null,
    needsOnboarding,
    accountReady,

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
