import { supabase } from "@/integrations/supabase/client";
import { signPhoto } from "./db";

export type AppRole = "admin" | "coach" | "player";

export type Team = {
  id: string;
  name: string;
  age_group: string | null;
  gender: string;
  about: string | null;
  photo_path: string | null;
  join_code: string;
  club_id: string | null;
  created_by: string;
  club?: { id: string; name: string } | null;
  photoUrl?: string | null;
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: "coach" | "player";
  status: "pending" | "approved";
  created_at: string;
  displayName?: string | null;
};

export type TeamPlayer = {
  id: string;
  name: string;
  number: number | null;
  birth_date: string | null;
  gender: string | null;
  photo_path: string | null;
  photoUrl: string | null;
};

export type TeamEvent = {
  id: string;
  team_id: string;
  type: "training" | "match";
  title: string | null;
  starts_at: string;
  location: string | null;
  notes: string | null;
};

export const GENDER_LABELS: Record<string, string> = {
  boy: "Pojke",
  girl: "Flicka",
  none: "Inget alternativ",
};

export const TEAM_GENDER_LABELS: Record<string, string> = {
  boys: "Pojklag",
  girls: "Flicklag",
  mixed: "Mixat",
};

/* ---------------- roles ---------------- */

export async function fetchMyRoles(): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role");
  if (error) throw error;
  return (data ?? []).map((row) => row.role as AppRole);
}

export async function claimRole(userId: string, role: Exclude<AppRole, "admin">) {
  const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
  if (error && !error.message.includes("duplicate")) throw error;
}

export async function updateProfile(input: {
  id: string;
  display_name?: string | null;
  birth_date?: string | null;
  is_adult_confirmed?: boolean;
  avatar_path?: string | null;
}) {
  const { id, ...rest } = input;
  const { error } = await supabase.from("profiles").update(rest).eq("id", id);
  if (error) throw error;
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, birth_date, avatar_path, is_adult_confirmed")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* ---------------- teams ---------------- */

export async function fetchMyTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, age_group, gender, about, photo_path, join_code, club_id, created_by, clubs(id, name)")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => ({
      ...(row as unknown as Team),
      club: (row as unknown as { clubs: { id: string; name: string } | null }).clubs,
      photoUrl: await signPhoto(row.photo_path),
    })),
  );
}

export async function fetchTeam(id: string): Promise<Team> {
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, age_group, gender, about, photo_path, join_code, club_id, created_by, clubs(id, name)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    ...(data as unknown as Team),
    club: (data as unknown as { clubs: { id: string; name: string } | null }).clubs,
    photoUrl: await signPhoto(data.photo_path),
  };
}

export async function fetchClubs() {
  const { data, error } = await supabase.from("clubs").select("id, name, city").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createTeam(input: {
  userId: string;
  clubName: string;
  clubId: string | null;
  name: string;
  ageGroup: string;
  gender: string;
}) {
  let clubId = input.clubId;
  if (!clubId && input.clubName.trim()) {
    const { data, error } = await supabase
      .from("clubs")
      .insert({ name: input.clubName.trim(), created_by: input.userId })
      .select("id")
      .single();
    if (error) throw error;
    clubId = data.id;
  }

  const { data, error } = await supabase
    .from("teams")
    .insert({
      created_by: input.userId,
      club_id: clubId,
      name: input.name.trim(),
      age_group: input.ageGroup.trim() || null,
      gender: input.gender,
    })
    .select("id")
    .single();
  if (error) throw error;

  const { error: memberError } = await supabase.from("team_members").insert({
    team_id: data.id,
    user_id: input.userId,
    role: "coach",
    status: "approved",
  });
  if (memberError) throw memberError;

  return data.id as string;
}

export async function updateTeam(id: string, patch: Partial<Pick<Team, "name" | "age_group" | "gender" | "about" | "photo_path">>) {
  const { error } = await supabase.from("teams").update(patch).eq("id", id);
  if (error) throw error;
}

/* ---------------- membership ---------------- */

export async function fetchMyMemberships() {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, team_id, role, status, teams(id, name, age_group, gender)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    team_id: row.team_id as string,
    role: row.role as "coach" | "player",
    status: row.status as "pending" | "approved",
    team: (row as unknown as { teams: { id: string; name: string; age_group: string | null; gender: string } | null }).teams,
  }));
}

export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, team_id, user_id, role, status, created_at")
    .eq("team_id", teamId)
    .order("created_at");
  if (error) throw error;

  const rows = (data ?? []) as TeamMember[];
  const ids = rows.map((row) => row.user_id);
  if (!ids.length) return rows;

  const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  const names = new Map((profiles ?? []).map((p) => [p.id as string, p.display_name as string | null]));
  return rows.map((row) => ({ ...row, displayName: names.get(row.user_id) ?? null }));
}

export async function findTeamByCode(code: string) {
  const { data, error } = await supabase.rpc("find_team_by_code", { _code: code });
  if (error) throw error;
  const rows = (data ?? []) as { id: string; name: string; age_group: string | null; club_name: string | null }[];
  return rows[0] ?? null;
}

export async function requestJoin(teamId: string, userId: string) {
  const { error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: userId, role: "player", status: "pending" });
  if (error) throw error;
}

export async function setMemberStatus(id: string, status: "approved" | "pending") {
  const { error } = await supabase.from("team_members").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function removeMember(id: string) {
  const { error } = await supabase.from("team_members").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- team players ---------------- */

export async function fetchTeamPlayers(teamId: string): Promise<TeamPlayer[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, number, birth_date, gender, photo_path")
    .eq("team_id", teamId)
    .order("name");
  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => ({
      ...(row as unknown as TeamPlayer),
      photoUrl: await signPhoto(row.photo_path),
    })),
  );
}

export async function saveTeamPlayer(input: {
  id?: string | undefined;
  teamId: string;
  userId: string;
  name: string;
  number: number | null;
  birth_date: string | null;
  gender: string | null;
  photo_path: string | null;
}) {
  const patch = {
    name: input.name,
    number: input.number,
    birth_date: input.birth_date,
    gender: input.gender,
    photo_path: input.photo_path,
  };
  if (input.id) {
    const { error } = await supabase.from("players").update(patch).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase
    .from("players")
    .insert({ ...patch, team_id: input.teamId, user_id: input.userId, team: "home" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteTeamPlayer(id: string) {
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- events ---------------- */

export async function fetchEvents(teamId: string, type?: "training" | "match"): Promise<TeamEvent[]> {
  let query = supabase
    .from("events")
    .select("id, team_id, type, title, starts_at, location, notes")
    .eq("team_id", teamId)
    .order("starts_at");
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TeamEvent[];
}

export async function saveEvent(input: {
  id?: string | undefined;
  teamId: string;
  userId: string;
  type: "training" | "match";
  title: string | null;
  starts_at: string;
  location: string | null;
  notes: string | null;
}) {
  const patch = {
    type: input.type,
    title: input.title,
    starts_at: input.starts_at,
    location: input.location,
    notes: input.notes,
  };
  if (input.id) {
    const { error } = await supabase.from("events").update(patch).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase
    .from("events")
    .insert({ ...patch, team_id: input.teamId, created_by: input.userId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- admin ---------------- */

export async function fetchAdminOverview() {
  const [clubs, teams, members, profiles, players] = await Promise.all([
    supabase.from("clubs").select("id, name, city"),
    supabase.from("teams").select("id, name, age_group, gender, club_id, join_code"),
    supabase.from("team_members").select("id, team_id, user_id, role, status"),
    supabase.from("profiles").select("id, display_name"),
    supabase.from("players").select("id, name, team_id"),
  ]);
  if (clubs.error) throw clubs.error;
  return {
    clubs: clubs.data ?? [],
    teams: teams.data ?? [],
    members: members.data ?? [],
    profiles: profiles.data ?? [],
    players: players.data ?? [],
  };
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
