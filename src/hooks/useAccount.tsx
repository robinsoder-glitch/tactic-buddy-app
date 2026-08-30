import { useQuery } from "@tanstack/react-query";
import { fetchMyRoles, fetchMyMemberships, fetchProfile } from "@/lib/teams";
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

  return {
    user,
    userId,
    profile: profile.data ?? null,
    roles: roleList,
    isAdmin: roleList.includes("admin"),
    isCoach: roleList.includes("coach"),
    isPlayer: roleList.includes("player"),
    memberships: memberships.data ?? [],
    loading: loading || roles.isLoading || memberships.isLoading,
  };
}
