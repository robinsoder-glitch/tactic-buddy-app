import { supabase } from "@/integrations/supabase/client";
import { signPhoto } from "./db";

export const TEAM_MEDIA_BUCKET = "team-media";

export type AppRole = "admin" | "coach" | "player";

export type Team = {
  id: string;
  name: string;
  age_group: string | null;
  /** Spelform laget spelar, t.ex. 5v5. Styr planstorleken på taktiktavlan. */
  game_format: string | null;
  gender: string;
  about: string | null;
  home_ground: string | null;
  photo_path: string | null;
  club_id: string | null;
  created_by: string;
  archived_at: string | null;
  club?: { id: string; name: string } | null;
  photoUrl?: string | null;
};

export type TeamMemberRole = "club_admin" | "head_coach" | "coach" | "guardian" | "player";

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  status: "pending" | "approved";
  created_at: string;
  joined_via?: string | null;
  displayName?: string | null;
  /** Barnets namn när medlemmen är vårdnadshavare. */
  guardianForName?: string | null;
};

/**
 * Känsliga fält (födelsedatum, vårdnadshavare, allergi) finns bara med när
 * databasen tillåter det: lagets ledare, plattformsadmin, spelaren själv eller
 * kopplad vårdnadshavare. Övriga lagmedlemmar får dem som null/undefined.
 */
export type TeamPlayer = {
  id: string;
  name: string;
  number: number | null;
  birth_date: string | null;
  gender: string | null;
  photo_path: string | null;
  is_goalkeeper: boolean;
  guardian1_name: string | null;
  guardian1_phone: string | null;
  guardian1_email: string | null;
  guardian2_name: string | null;
  guardian2_phone: string | null;
  guardian2_email: string | null;
  has_allergy: boolean;
  allergy_note: string | null;
  is_active?: boolean;
  photoUrl: string | null;
};

export type TeamPhoto = {
  id: string;
  team_id: string;
  path: string;
  caption: string | null;
  created_at: string;
  url: string | null;
};

export type TeamEvent = {
  id: string;
  team_id: string;
  type: "training" | "match";
  title: string | null;
  starts_at: string;
  ends_at: string | null;
  meet_at: string | null;
  home_team: string | null;
  away_team: string | null;
  kit: string | null;
  match_kind: string | null;
  series_id: string | null;
  location: string | null;
  notes: string | null;
  match_duration_minutes?: number | null;
  cancelled_at?: string | null;
  invites_closed_at?: string | null;
};

/* ---------------- team media ---------------- */

export async function signTeamMedia(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(TEAM_MEDIA_BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function uploadTeamMedia(
  teamId: string,
  file: File,
  folder = "misc",
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${teamId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(TEAM_MEDIA_BUCKET)
    .upload(path, file, { upsert: true });
  if (error) throw error;
  return path;
}

export async function removeTeamMedia(path: string) {
  await supabase.storage.from(TEAM_MEDIA_BUCKET).remove([path]);
}

/** Team media paths look like "<teamId>/...", older photos live in the personal bucket. */
async function signTeamOrLegacy(path: string | null, teamId: string): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith(`${teamId}/`)) return signTeamMedia(path);
  return signPhoto(path);
}

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
  guardian_for_name?: string | null;
}) {
  const { id, ...raw } = input;
  const rest = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== undefined),
  ) as Omit<typeof input, "id">;
  const { error } = await supabase.from("profiles").update(rest).eq("id", id);
  if (error) throw error;
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, birth_date, avatar_path, is_adult_confirmed, guardian_for_name")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* ---------------- teams ---------------- */

export async function fetchMyTeams(): Promise<Team[]> {
  const { data, error } = await supabase
    .from("teams")
    .select(
      "id, name, age_group, game_format, gender, about, home_ground, photo_path, club_id, created_by, archived_at, clubs(id, name)",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => ({
      ...(row as unknown as Team),
      club: (row as unknown as { clubs: { id: string; name: string } | null }).clubs,
      photoUrl: await signTeamOrLegacy(row.photo_path, row.id as string),
    })),
  );
}

export async function fetchTeam(id: string): Promise<Team> {
  const { data, error } = await supabase
    .from("teams")
    .select(
      "id, name, age_group, game_format, gender, about, home_ground, photo_path, club_id, created_by, archived_at, clubs(id, name)",
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  return {
    ...(data as unknown as Team),
    club: (data as unknown as { clubs: { id: string; name: string } | null }).clubs,
    photoUrl: await signTeamOrLegacy(data.photo_path, id),
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
  /** Spelform, t.ex. "5v5". Styr planstorleken på taktiktavlan. */
  gameFormat?: string | null;
  homeGround?: string | null;
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
      game_format: input.gameFormat ?? null,
      gender: input.gender,
      home_ground: input.homeGround?.trim() || null,
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

export async function updateTeam(
  id: string,
  patch: Partial<
    Pick<
      Team,
      "name" | "age_group" | "game_format" | "gender" | "about" | "home_ground" | "photo_path"
    >
  >,
) {
  const { error } = await supabase.from("teams").update(patch).eq("id", id);
  if (error) throw error;
}

/* ---------------- membership ---------------- */

export async function fetchMyMemberships() {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("team_members")
    .select("id, team_id, role, status, can_manage_attendance, teams(id, name, age_group, gender)")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    team_id: row.team_id as string,
    role: row.role as "coach" | "head_coach" | "club_admin" | "player" | "guardian",
    status: row.status as "pending" | "approved",
    can_manage_attendance: Boolean(
      (row as unknown as { can_manage_attendance?: boolean }).can_manage_attendance,
    ),
    team: (
      row as unknown as {
        teams: { id: string; name: string; age_group: string | null; gender: string } | null;
      }
    ).teams,
  }));
}

/** Antal obesvarade ansökningar per lag – används för notisprickar i menyn. */
export async function fetchPendingJoinCounts(teamIds: string[]): Promise<Record<string, number>> {
  if (!teamIds.length) return {};
  const { data, error } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("status", "pending")
    .in("team_id", teamIds);
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = row.team_id as string;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, team_id, user_id, role, status, created_at, joined_via")
    .eq("team_id", teamId)
    .order("created_at");
  if (error) throw error;

  const rows = (data ?? []) as TeamMember[];
  const ids = rows.map((row) => row.user_id);
  if (!ids.length) return rows;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, guardian_for_name")
    .in("id", ids);
  const names = new Map(
    (profiles ?? []).map((p) => [
      p.id as string,
      {
        name: (p.display_name as string | null) ?? null,
        child: (p as { guardian_for_name?: string | null }).guardian_for_name ?? null,
      },
    ]),
  );
  return rows.map((row) => ({
    ...row,
    displayName: names.get(row.user_id)?.name ?? null,
    guardianForName: names.get(row.user_id)?.child ?? null,
  }));
}

export type TeamCodeMatch = {
  id: string;
  name: string;
  age_group: string | null;
  club_name: string | null;
  /** "coach" när koden är lagets tränarkod, annars "player". */
  join_role: "coach" | "player";
};

export async function findTeamByCode(code: string): Promise<TeamCodeMatch | null> {
  const { data, error } = await supabase.rpc("find_team_by_code", {
    _code: code.trim().toUpperCase(),
  });
  if (error) throw error;
  const rows = (data ?? []) as TeamCodeMatch[];
  return rows[0] ?? null;
}

/** Ansluter inloggad användare till laget som spelare eller tränare beroende på koden. */
export async function joinTeamWithCode(
  code: string,
  accountKind: "coach" | "player" | "guardian",
): Promise<{
  teamId: string;
  teamName: string;
  role: "coach" | "player" | "guardian";
  status: "pending" | "approved";
}> {
  const { data, error } = await supabase.rpc("join_team_with_code", {
    _code: code.trim().toUpperCase(),
    _account_kind: accountKind,
  });
  if (error) throw error;
  const row = (
    (data ?? []) as {
      team_id: string;
      team_name: string;
      member_role: "coach" | "player" | "guardian";
      member_status: "pending" | "approved";
    }[]
  )[0];
  if (!row) throw new Error("Koden stämmer inte. Kontrollera de sex tecknen med din tränare.");
  return {
    teamId: row.team_id,
    teamName: row.team_name,
    role: row.member_role,
    status: row.member_status,
  };
}

/**
 * Lagets koder hämtas via en skyddad databasfunktion. Bara godkända tränare i
 * laget (och plattformens administratör) får svar – koderna finns inte längre
 * med i lagets vanliga uppgifter.
 */
export async function fetchTeamCodes(
  teamId: string,
): Promise<{ join_code: string; coach_join_code: string }> {
  const { data, error } = await supabase.rpc("get_team_codes", { _team_id: teamId });
  if (error) throw error;
  const row = (data as { join_code: string; coach_join_code: string }[] | null)?.[0];
  if (!row) throw new Error("Lagets koder kunde inte hämtas.");
  return row;
}

/** Skapar en ny spelar- eller tränarkod. Endast lagets tränare. */
export async function rotateTeamCode(teamId: string, kind: "player" | "coach"): Promise<string> {
  const { data, error } = await supabase.rpc("rotate_team_code", { _team_id: teamId, _kind: kind });
  if (error) throw error;
  return data as string;
}

export async function fetchMembership(teamId: string, userId: string) {
  const { data, error } = await supabase
    .from("team_members")
    .select("id, status, role")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; status: "pending" | "approved"; role: "coach" | "player" } | null;
}

export async function requestJoin(teamId: string, userId: string) {
  const existing = await fetchMembership(teamId, userId);
  if (existing) return existing.status;
  const { error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, user_id: userId, role: "player", status: "pending" });
  if (error) throw error;
  return "pending" as const;
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

type PlayerPrivateRow = {
  player_id: string;
  birth_date: string | null;
  guardian1_name: string | null;
  guardian1_phone: string | null;
  guardian1_email: string | null;
  guardian2_name: string | null;
  guardian2_phone: string | null;
  guardian2_email: string | null;
  has_allergy: boolean | null;
  allergy_note: string | null;
};

const EMPTY_PRIVATE = {
  birth_date: null,
  guardian1_name: null,
  guardian1_phone: null,
  guardian1_email: null,
  guardian2_name: null,
  guardian2_phone: null,
  guardian2_email: null,
  has_allergy: false,
  allergy_note: null,
} as const;

export async function fetchTeamPlayers(teamId: string): Promise<TeamPlayer[]> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, number, gender, photo_path, is_goalkeeper, is_active")
    .eq("team_id", teamId)
    .order("name");
  if (error) throw error;

  // Känsliga uppgifter hämtas separat – databasen avgör vem som får se dem.
  const privateById = new Map<string, PlayerPrivateRow>();
  const priv = await supabase.rpc("get_team_players_private", { _team_id: teamId });
  if (!priv.error) {
    for (const row of (priv.data ?? []) as PlayerPrivateRow[]) {
      privateById.set(row.player_id, row);
    }
  }

  return Promise.all(
    (data ?? []).map(async (row) => {
      const secret = privateById.get(row.id);
      return {
        ...EMPTY_PRIVATE,
        ...(secret
          ? {
              birth_date: secret.birth_date,
              guardian1_name: secret.guardian1_name,
              guardian1_phone: secret.guardian1_phone,
              guardian1_email: secret.guardian1_email,
              guardian2_name: secret.guardian2_name,
              guardian2_phone: secret.guardian2_phone,
              guardian2_email: secret.guardian2_email,
              has_allergy: secret.has_allergy ?? false,
              allergy_note: secret.allergy_note,
            }
          : {}),
        ...(row as unknown as Omit<TeamPlayer, keyof typeof EMPTY_PRIVATE | "photoUrl">),
        photoUrl: await signTeamOrLegacy(row.photo_path, teamId),
      } as TeamPlayer;
    }),
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
  is_goalkeeper: boolean;
  photo_path: string | null;
  guardian1_name?: string | null;
  guardian1_phone?: string | null;
  guardian1_email?: string | null;
  guardian2_name?: string | null;
  guardian2_phone?: string | null;
  guardian2_email?: string | null;
  has_allergy?: boolean;
  allergy_note?: string | null;
}) {
  const patch = {
    name: input.name,
    number: input.number,
    birth_date: input.birth_date,
    gender: input.gender,
    is_goalkeeper: input.is_goalkeeper,
    photo_path: input.photo_path,
    guardian1_name: input.guardian1_name ?? null,
    guardian1_phone: input.guardian1_phone ?? null,
    guardian1_email: input.guardian1_email ?? null,
    guardian2_name: input.guardian2_name ?? null,
    guardian2_phone: input.guardian2_phone ?? null,
    guardian2_email: input.guardian2_email ?? null,
    has_allergy: input.has_allergy ?? false,
    allergy_note: input.allergy_note ?? null,
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

/* ---------------- team photos ---------------- */

export async function fetchTeamPhotos(teamId: string): Promise<TeamPhoto[]> {
  const { data, error } = await supabase
    .from("team_photos")
    .select("id, team_id, path, caption, created_at")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => ({
      ...(row as unknown as TeamPhoto),
      url: await signTeamMedia(row.path as string),
    })),
  );
}

export async function addTeamPhoto(input: {
  teamId: string;
  userId: string;
  file: File;
  caption: string | null;
}) {
  const path = await uploadTeamMedia(input.teamId, input.file, "gallery");
  const { error } = await supabase
    .from("team_photos")
    .insert({ team_id: input.teamId, path, caption: input.caption, created_by: input.userId });
  if (error) throw error;
}

export async function deleteTeamPhoto(photo: { id: string; path: string }) {
  const { error } = await supabase.from("team_photos").delete().eq("id", photo.id);
  if (error) throw error;
  await removeTeamMedia(photo.path);
}

/* ---------------- events ---------------- */

const EVENT_COLUMNS =
  "id, team_id, type, title, starts_at, ends_at, meet_at, home_team, away_team, kit, match_kind, series_id, location, notes, match_duration_minutes, cancelled_at, invites_closed_at";

export async function fetchEvent(id: string): Promise<TeamEvent> {
  const { data, error } = await supabase.from("events").select(EVENT_COLUMNS).eq("id", id).single();
  if (error) throw error;
  return data as TeamEvent;
}

export async function fetchEvents(
  teamId: string,
  type?: "training" | "match",
): Promise<TeamEvent[]> {
  let query = supabase
    .from("events")
    .select(EVENT_COLUMNS)
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
  ends_at?: string | null;
  meet_at?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  kit?: string | null;
  match_kind?: string | null;
  location: string | null;
  notes: string | null;
  repeat?: "none" | "weekly" | "monthly";
  repeatCount?: number;
}) {
  const patch = {
    type: input.type,
    title: input.title,
    starts_at: input.starts_at,
    ends_at: input.ends_at ?? null,
    meet_at: input.meet_at ?? null,
    home_team: input.home_team ?? null,
    away_team: input.away_team ?? null,
    kit: input.kit ?? null,
    match_kind: input.match_kind ?? null,
    location: input.location,
    notes: input.notes,
  };
  if (input.id) {
    const { error } = await supabase.from("events").update(patch).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const repeat = input.repeat ?? "none";
  const occurrences = repeat === "none" ? 1 : Math.max(1, Math.min(input.repeatCount ?? 8, 52));
  const seriesId = repeat === "none" ? null : crypto.randomUUID();

  const shift = (iso: string | null, index: number) => {
    if (!iso) return null;
    const date = new Date(iso);
    if (repeat === "weekly") date.setDate(date.getDate() + index * 7);
    if (repeat === "monthly") date.setMonth(date.getMonth() + index);
    return date.toISOString();
  };

  const rows = Array.from({ length: occurrences }, (_, index) => ({
    ...patch,
    starts_at: shift(patch.starts_at, index)!,
    ends_at: shift(patch.ends_at, index),
    meet_at: shift(patch.meet_at, index),
    series_id: seriesId,
    team_id: input.teamId,
    created_by: input.userId,
  }));

  const { data, error } = await supabase.from("events").insert(rows).select("id");
  if (error) throw error;
  return data?.[0]?.id as string;
}

export async function deleteEvent(id: string) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

/* ---------------- admin ---------------- */

export async function fetchAdminOverview() {
  const [clubs, teams, members, profiles, players] = await Promise.all([
    supabase.from("clubs").select("id, name, city"),
    supabase.from("teams").select("id, name, age_group, gender, club_id"),
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

/* ---------------- leader invites ---------------- */

export type TeamInvite = {
  id: string;
  team_id: string;
  email: string | null;
  role: "coach" | "player";
  created_at: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  invite_kind: "email" | "link";
  recipient_label: string | null;
  target_player_id: string | null;
};

export type InviteState = "active" | "accepted" | "revoked" | "expired";

export function inviteState(invite: TeamInvite): InviteState {
  if (invite.accepted_at) return "accepted";
  if (invite.revoked_at) return "revoked";
  if (new Date(invite.expires_at).getTime() <= Date.now()) return "expired";
  return "active";
}

export const INVITE_STATE_LABELS: Record<InviteState, string> = {
  active: "Väntar på svar",
  accepted: "Accepterad",
  revoked: "Återkallad",
  expired: "Utgången",
};

export function inviteLink(token: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/inbjudan/${token}`;
}

const INVITE_COLUMNS =
  "id, team_id, email, role, created_at, token, expires_at, accepted_at, revoked_at, invite_kind, recipient_label, target_player_id";

export async function fetchTeamInvites(teamId: string): Promise<TeamInvite[]> {
  const { data, error } = await supabase
    .from("team_invites")
    .select(INVITE_COLUMNS)
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TeamInvite[];
}

export async function addTeamInvite(input: {
  teamId: string;
  userId: string;
  /** Tom sträng eller null skapar en kopierbar länk utan e-postlås. */
  email?: string | null;
  role?: "coach" | "player";
  days?: number;
  kind?: "email" | "link";
  recipientLabel?: string | null;
  targetPlayerId?: string | null;
}): Promise<TeamInvite> {
  const kind = input.kind ?? "email";
  const raw = (input.email ?? "").trim().toLowerCase();
  if (kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw))
    throw new Error("Ange en giltig e-postadress");
  if (kind === "link" && raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw))
    throw new Error("Ange en giltig e-postadress eller lämna fältet tomt");
  const days = input.days ?? 14;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("team_invites")
    .insert({
      team_id: input.teamId,
      created_by: input.userId,
      email: raw ? raw : null,
      role: input.role ?? "coach",
      expires_at: expires,
      invite_kind: kind,
      recipient_label: input.recipientLabel?.trim() || null,
      target_player_id: input.targetPlayerId ?? null,
    })
    .select(INVITE_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505")
      throw new Error("Det finns redan en öppen inbjudan till den adressen.");
    throw error;
  }
  return data as unknown as TeamInvite;
}

/** Revoke an invite so its one-time link stops working. */
export async function revokeTeamInvite(id: string) {
  const { error } = await supabase
    .from("team_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function removeTeamInvite(id: string) {
  const { error } = await supabase.from("team_invites").delete().eq("id", id);
  if (error) throw error;
}

/** Turn an approved member into a leader (or back to a player). */
export async function setMemberRole(id: string, role: TeamMemberRole) {
  const { error } = await supabase.from("team_members").update({ role }).eq("id", id);
  if (error) throw error;
}

export type InvitePreview = {
  state: "active" | "expired" | "used" | "revoked" | "archived" | "invalid";
  team_name: string | null;
  club_name: string | null;
  age_group: string | null;
  invite_role: "coach" | "player" | null;
  expires_at: string | null;
  email_locked: boolean;
};

/** Ofarlig förhandsvisning av en personlig inbjudan – fungerar utan inloggning. */
export async function previewTeamInvite(token: string): Promise<InvitePreview> {
  const { data, error } = await supabase.rpc("preview_team_invite", { _token: token });
  if (error) throw new Error(error.message);
  const row = ((data ?? []) as unknown as InvitePreview[])[0];
  return (
    row ?? {
      state: "invalid",
      team_name: null,
      club_name: null,
      age_group: null,
      invite_role: null,
      expires_at: null,
      email_locked: false,
    }
  );
}

export type AcceptInviteResult = {
  teamId: string;
  role: "coach" | "player" | "guardian";
  status: "pending" | "approved";
  alreadyMember: boolean;
};

/** Accept a personal, one-time invite. */
export async function acceptTeamInvite(
  token: string,
  accountKind?: "player" | "guardian",
): Promise<AcceptInviteResult> {
  const { data, error } = await supabase.rpc("accept_team_invite", {
    _token: token,
    ...(accountKind ? { _account_kind: accountKind } : {}),
  });
  if (error) throw new Error(error.message);
  const row = (
    (data ?? []) as unknown as {
      team_id: string;
      member_role: "coach" | "player" | "guardian";
      member_status: "pending" | "approved";
      already_member: boolean;
    }[]
  )[0];
  if (!row) throw new Error("Länken är ogiltig.");
  return {
    teamId: row.team_id,
    role: row.member_role,
    status: row.member_status,
    alreadyMember: row.already_member,
  };
}

/**
 * Godkänner en ansökan i ett steg. För spelare och vårdnadshavare måste
 * tränaren peka ut spelarkortet – databasen gissar aldrig utifrån namn.
 */
export async function approveTeamJoinRequest(
  memberId: string,
  playerId: string | null = null,
): Promise<{ role: string; linkedPlayerId: string | null }> {
  const { data, error } = await supabase.rpc("approve_team_join_request", {
    _member_id: memberId,
    ...(playerId ? { _player_id: playerId } : {}),
  });
  if (error) throw new Error(error.message);
  const row = (
    (data ?? []) as unknown as { member_role: string; linked_player_id: string | null }[]
  )[0];
  return { role: row?.member_role ?? "player", linkedPlayerId: row?.linked_player_id ?? null };
}

/* ---------------- archive & delete ---------------- */

export async function setTeamArchived(teamId: string, archived: boolean) {
  const { error } = await supabase
    .from("teams")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", teamId);
  if (error) throw error;
}

export async function deleteTeam(teamId: string) {
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) throw error;
}

/** Generate a fresh join code so an old, spread code stops working. */
export async function regenerateJoinCode(teamId: string): Promise<string> {
  return rotateTeamCode(teamId, "player");
}

/* ---------------- lagägare ---------------- */

/**
 * Ser till att den som skapade laget alltid finns som godkänd ledare.
 * Rättar äldre lag där medlemsraden saknas och som därför visade "Inga ledare ännu".
 */
export async function ensureOwnerMembership(teamId: string, userId: string) {
  const { data } = await supabase
    .from("team_members")
    .select("id, role, status")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    const { error } = await supabase
      .from("team_members")
      .insert({ team_id: teamId, user_id: userId, role: "coach", status: "approved" });
    if (error) throw error;
    return;
  }
  if (data.role !== "coach" || data.status !== "approved") {
    const { error } = await supabase
      .from("team_members")
      .update({ role: "coach", status: "approved" })
      .eq("id", data.id);
    if (error) throw error;
  }
}

/** Överlåt lagägarskapet till en annan godkänd ledare. */
export async function transferTeamOwnership(teamId: string, newOwnerUserId: string) {
  await ensureOwnerMembership(teamId, newOwnerUserId);
  const { error } = await supabase
    .from("teams")
    .update({ created_by: newOwnerUserId })
    .eq("id", teamId);
  if (error) throw error;
}

export type TeamImpact = {
  players: number;
  events: number;
  photos: number;
  attendance: number;
  stats: number;
  members: number;
};

/** Räknar vad som försvinner om laget raderas permanent. */
export async function fetchTeamImpact(teamId: string): Promise<TeamImpact> {
  const count = async (
    table:
      "players" | "events" | "team_photos" | "event_attendance" | "player_stats" | "team_members",
  ) => {
    const { count: rows } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("team_id", teamId);
    return rows ?? 0;
  };
  const [players, events, photos, attendance, stats, members] = await Promise.all([
    count("players"),
    count("events"),
    count("team_photos"),
    count("event_attendance"),
    count("player_stats"),
    count("team_members"),
  ]);
  return { players, events, photos, attendance, stats, members };
}

/** Normaliserar ett spelarnamn för jämförelse (skiftläge, mellanslag och accenter). */
export function normalizePlayerName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Hittar spelare med samma eller mycket likt namn. Dubbletter är tillåtna –
 * detta används bara för en varning innan en ny spelare skapas.
 */
export function findSimilarPlayers<T extends { id: string; name: string }>(
  name: string,
  players: T[],
  excludeId?: string,
): T[] {
  const needle = normalizePlayerName(name);
  if (!needle) return [];
  return players.filter(
    (player) => player.id !== excludeId && normalizePlayerName(player.name) === needle,
  );
}

/* ---------------- koppla spelarkonto till spelarkort ---------------- */

/** Vilket konto som är kopplat till spelarkortet, om något. */
export async function fetchPlayerAccount(playerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("players")
    .select("member_user_id")
    .eq("id", playerId)
    .maybeSingle();
  if (error) throw error;
  return (data?.member_user_id as string | null) ?? null;
}

/** Vilka konton i laget som redan är kopplade till ett spelarkort. */
export async function fetchLinkedPlayerAccounts(teamId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("players")
    .select("member_user_id")
    .eq("team_id", teamId);
  if (error) throw error;
  return new Set(
    (data ?? [])
      .map((row) => row.member_user_id as string | null)
      .filter((value): value is string => Boolean(value)),
  );
}

/** Kopplar (eller kopplar loss) spelarens eget konto. Kallelser går sedan till kontot. */
export async function setPlayerAccount(playerId: string, userId: string | null) {
  const { error } = await supabase
    .from("players")
    .update({ member_user_id: userId })
    .eq("id", playerId);
  if (error) throw error;
}
