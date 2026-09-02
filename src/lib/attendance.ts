import { supabase } from "@/integrations/supabase/client";
import type { TeamEvent, TeamPlayer } from "./teams";

/** Möjliga närvarostatusar för en spelare vid en händelse. */
export const ATTENDANCE_STATUSES = ["present", "partial", "absent"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Närvarande",
  partial: "Del av aktiviteten",
  absent: "Frånvarande",
};

export const ATTENDANCE_SHORT: Record<AttendanceStatus, string> = {
  present: "Här",
  partial: "Del",
  absent: "Borta",
};

/** Snabbval för speltid, angivet som andel av matchens längd. */
export const PLAYING_TIME_PRESETS = [
  { id: "full", label: "Hela matchen", share: 1 },
  { id: "three_quarters", label: "Ungefär 3/4", share: 0.75 },
  { id: "half", label: "Ungefär halva matchen", share: 0.5 },
  { id: "quarter", label: "Ungefär 1/4", share: 0.25 },
] as const;

/** Räknar om ett snabbval till minuter utifrån matchens längd. */
export function minutesFromShare(share: number, durationMinutes: number | null): number | null {
  if (!durationMinutes || durationMinutes <= 0) return null;
  return Math.round(durationMinutes * share);
}

/** Andel av matchen i procent, avrundat till heltal. */
export function playingTimeShare(minutes: number | null, durationMinutes: number | null): number | null {
  if (minutes === null || !durationMinutes || durationMinutes <= 0) return null;
  return Math.round((minutes / durationMinutes) * 100);
}

/** Validerar speltid mot matchens längd. Returnerar svenskt felmeddelande eller null. */
export function validateMinutes(minutes: number | null, durationMinutes: number | null): string | null {
  if (minutes === null) return null;
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) return "Ange speltiden i hela minuter.";
  if (minutes < 0) return "Speltiden kan inte vara negativ.";
  if (durationMinutes && minutes > durationMinutes) {
    return `Speltiden kan inte vara längre än matchens ${durationMinutes} minuter.`;
  }
  return null;
}

export type AttendanceRow = {
  id: string;
  event_id: string;
  team_id: string;
  player_id: string;
  status: AttendanceStatus;
  note: string | null;
  minutes_played: number | null;
};

const COLUMNS = "id, event_id, team_id, player_id, status, note, minutes_played";

export async function fetchTeamAttendance(teamId: string): Promise<AttendanceRow[]> {
  const { data, error } = await supabase.from("event_attendance").select(COLUMNS).eq("team_id", teamId);
  if (error) throw error;
  return (data ?? []) as unknown as AttendanceRow[];
}

export async function fetchEventAttendance(eventId: string): Promise<AttendanceRow[]> {
  const { data, error } = await supabase.from("event_attendance").select(COLUMNS).eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []) as unknown as AttendanceRow[];
}

/** Sparar (eller uppdaterar) närvaron för en spelare vid en händelse. */
export async function setAttendance(input: {
  eventId: string;
  teamId: string;
  playerId: string;
  userId: string;
  status: AttendanceStatus;
  note?: string | null;
  minutesPlayed?: number | null;
}) {
  const { error } = await supabase.from("event_attendance").upsert(
    {
      event_id: input.eventId,
      team_id: input.teamId,
      player_id: input.playerId,
      created_by: input.userId,
      registered_by: input.userId,
      updated_by: input.userId,
      status: input.status,
      note: input.note ?? null,
      minutes_played: input.minutesPlayed ?? null,
    },
    { onConflict: "event_id,player_id" },
  );
  if (error) throw error;
}

/** Tar bort en registrering, vilket gör spelaren oregistrerad igen. */
export async function clearAttendance(eventId: string, playerId: string) {
  const { error } = await supabase
    .from("event_attendance")
    .delete()
    .eq("event_id", eventId)
    .eq("player_id", playerId);
  if (error) throw error;
}

/** Markerar alla spelare med samma status i en händelse. */
export async function setAttendanceForAll(input: {
  eventId: string;
  teamId: string;
  userId: string;
  playerIds: string[];
  status: AttendanceStatus;
}) {
  if (!input.playerIds.length) return;
  const { error } = await supabase.from("event_attendance").upsert(
    input.playerIds.map((playerId) => ({
      event_id: input.eventId,
      team_id: input.teamId,
      player_id: playerId,
      created_by: input.userId,
      registered_by: input.userId,
      updated_by: input.userId,
      status: input.status,
    })),
    { onConflict: "event_id,player_id" },
  );
  if (error) throw error;
}

/* ---------------- beräkningar ---------------- */

export type PlayerAttendanceSummary = {
  playerId: string;
  name: string;
  trainings: number;
  trainingsTotal: number;
  matches: number;
  matchesTotal: number;
  partial: number;
  absent: number;
  minutesPlayed: number;
};

/** Räknas spelaren som deltagande? Del av aktiviteten räknas som deltagande. */
export function counts(status: AttendanceStatus): boolean {
  return status === "present" || status === "partial";
}

/** Händelser som redan har startat – bara de ingår i statistiken. */
export function pastEvents(events: TeamEvent[], now: Date = new Date()): TeamEvent[] {
  return events.filter((event) => new Date(event.starts_at).getTime() <= now.getTime());
}

/** Sammanställer träningar och matcher per spelare. */
export function summarize(
  players: Pick<TeamPlayer, "id" | "name">[],
  events: TeamEvent[],
  rows: AttendanceRow[],
): PlayerAttendanceSummary[] {
  const byEvent = new Map(events.map((event) => [event.id, event.type]));
  const trainingsTotal = events.filter((event) => event.type === "training").length;
  const matchesTotal = events.filter((event) => event.type === "match").length;

  return players.map((player) => {
    const summary: PlayerAttendanceSummary = {
      playerId: player.id,
      name: player.name,
      trainings: 0,
      trainingsTotal,
      matches: 0,
      matchesTotal,
      partial: 0,
      absent: 0,
      minutesPlayed: 0,
    };
    for (const row of rows) {
      if (row.player_id !== player.id) continue;
      const type = byEvent.get(row.event_id);
      if (!type) continue;
      if (row.status === "partial") summary.partial += 1;
      if (row.status === "absent") summary.absent += 1;
      summary.minutesPlayed += row.minutes_played ?? 0;
      if (!counts(row.status)) continue;
      if (type === "training") summary.trainings += 1;
      else summary.matches += 1;
    }
    return summary;
  });
}

/** Närvaro i procent, avrundat till heltal. */
export function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** Antal registrerade spelare i en händelse. */
export function registeredCount(rows: AttendanceRow[], eventId: string): number {
  return rows.filter((row) => row.event_id === eventId).length;
}

/** Statistik som CSV med semikolon, för Excel på svenska. */
export function attendanceCsv(summaries: PlayerAttendanceSummary[]): string {
  const header = [
    "Spelare",
    "Träningar",
    "Träningar totalt",
    "Träningsnärvaro %",
    "Matcher",
    "Matcher totalt",
    "Matchnärvaro %",
    "Del av aktiviteten",
    "Frånvarande",
    "Spelade minuter",
  ].join(";");
  const lines = summaries.map((row) =>
    [
      row.name.replace(/;/g, ","),
      row.trainings,
      row.trainingsTotal,
      percent(row.trainings, row.trainingsTotal),
      row.matches,
      row.matchesTotal,
      percent(row.matches, row.matchesTotal),
      row.partial,
      row.absent,
      row.minutesPlayed,
    ].join(";"),
  );
  return [header, ...lines].join("\n");
}

/** Rubrik för en händelse i närvarolistan. */
export function eventLabel(event: TeamEvent): string {
  if (event.title) return event.title;
  if (event.type === "match") {
    const home = event.home_team ?? "Hemmalag";
    const away = event.away_team ?? "Bortalag";
    return `${home} – ${away}`;
  }
  return "Träning";
}
