import { supabase } from "@/integrations/supabase/client";

/** Alla lag i hela plattformen (kräver adminrättigheter i databasen). */
export async function fetchAllTeams() {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, age_group, gender, club_id, join_code, coach_join_code, home_ground, archived_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllClubs() {
  const { data, error } = await supabase.from("clubs").select("id, name, city").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchPlatformStats() {
  const tables = ["clubs", "teams", "players", "events", "tactics", "coach_sessions"] as const;
  const counts = await Promise.all(
    tables.map(async (table) => {
      const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
      return [table, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<(typeof tables)[number], number>;
}

export async function fetchTeamAdminDetail(teamId: string) {
  const [team, members, players, profiles] = await Promise.all([
    supabase.from("teams").select("*").eq("id", teamId).maybeSingle(),
    supabase.from("team_members").select("id, user_id, role, status, created_at").eq("team_id", teamId),
    supabase.from("players").select("id, name, number, is_active, member_user_id").eq("team_id", teamId).order("name"),
    supabase.from("profiles").select("id, display_name"),
  ]);
  if (team.error) throw team.error;
  const names = new Map((profiles.data ?? []).map((p) => [p.id, p.display_name]));
  return {
    team: team.data,
    members: (members.data ?? []).map((m) => ({ ...m, displayName: names.get(m.user_id) ?? null })),
    players: players.data ?? [],
  };
}

export async function fetchAuditLog() {
  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, actor_id, action, target_type, target_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}
