import { supabase } from "@/integrations/supabase/client";
import type { TeamEvent, TeamPlayer } from "./teams";

/** Möjliga närvarostatusar för en spelare vid en händelse. */
export const ATTENDANCE_STATUSES = ["present", "late", "sick", "absent"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "Närvarande",
  late: "Sen ankomst",
  sick: "Sjuk eller skadad",
  absent: "Frånvarande",
};

export const ATTENDANCE_SHORT: Record<AttendanceStatus, string> = {
  present: "Här",
  late: "Sen",
  sick: "Sjuk",
  absent: "Borta",
};

export type AttendanceRow = {
  id: string;
  event_id: string;
  team_id: string;
  player_id: string;
  status: AttendanceStatus;
  note: string | null;
};

const COLUMNS = "id, event_id, team_id, player_id, status, note";

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
}) {
  const { error } = await supabase.from("event_attendance").upsert(
    {
      event_id: input.eventId,
      team_id: input.teamId,
      player_id: input.playerId,
      created_by: input.userId,
      status: input.status,
      note: input.note ?? null,
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
  late: number;
  sick: number;
  absent: number;
};

/** Räknas spelaren som deltagande? Sen ankomst räknas som deltagande. */
export function counts(status: AttendanceStatus): boolean {
  return status === "present" || status === "late";
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
      late: 0,
      sick: 0,
      absent: 0,
    };
    for (const row of rows) {
      if (row.player_id !== player.id) continue;
      const type = byEvent.get(row.event_id);
      if (!type) continue;
      if (row.status === "late") summary.late += 1;
      if (row.status === "sick") summary.sick += 1;
      if (row.status === "absent") summary.absent += 1;
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
    "Sen ankomst",
    "Sjuk eller skadad",
    "Frånvarande",
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
      row.late,
      row.sick,
      row.absent,
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
