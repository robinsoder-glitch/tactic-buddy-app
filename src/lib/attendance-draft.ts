/**
 * Etapp 6 – närvaroutkast. Kallelsesvaren får föreslå närvaro, men ingenting
 * sparas förrän tränaren trycker Spara närvaro.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AttendanceRow, AttendanceStatus } from "./attendance";

export const ABSENCE_REASONS = ["sick", "injured", "other"] as const;
export type AbsenceReason = (typeof ABSENCE_REASONS)[number];

export const ABSENCE_REASON_LABELS: Record<AbsenceReason, string> = {
  sick: "Sjuk",
  injured: "Skadad",
  other: "Annat",
};

export const ABSENCE_REASON_UNSET = "Ej angivet";

/** En rad i utkastet. `status: null` betyder Ej registrerad. */
export type DraftEntry = {
  status: AttendanceStatus | null;
  minutes: number | null;
  reason: AbsenceReason | null;
  note: string;
};

export type Draft = Record<string, DraftEntry>;

export const EMPTY_ENTRY: DraftEntry = { status: null, minutes: null, reason: null, note: "" };

/** Utkast som speglar det som redan är sparat. */
export function draftFromRows(playerIds: string[], rows: AttendanceRow[]): Draft {
  const byPlayer = new Map(rows.map((row) => [row.player_id, row]));
  const draft: Draft = {};
  for (const id of playerIds) {
    const row = byPlayer.get(id);
    draft[id] = row
      ? {
          status: row.status,
          minutes: row.minutes_played ?? null,
          reason: ((row as { absence_reason?: string | null }).absence_reason ??
            null) as AbsenceReason | null,
          note: row.note ?? "",
        }
      : { ...EMPTY_ENTRY };
  }
  return draft;
}

/** Kallelsesvar → föreslagen närvarostatus. */
export function statusFromInvite(status: string | null | undefined): AttendanceStatus | null {
  if (status === "attending") return "present";
  if (status === "declined") return "absent";
  return null; // Kanske och Ej svarat lämnas oregistrerade
}

/**
 * Bygger ett förslag från kallelsesvaren. Spelare som redan har en sparad
 * närvaro behåller den – inget skrivs över.
 */
export function draftFromInvitations(
  playerIds: string[],
  invitations: { player_id: string; status: string }[],
  rows: AttendanceRow[],
): Draft {
  const base = draftFromRows(playerIds, rows);
  const saved = new Set(rows.map((row) => row.player_id));
  const byPlayer = new Map(invitations.map((invite) => [invite.player_id, invite.status]));
  for (const id of playerIds) {
    if (saved.has(id)) continue;
    const suggestion = statusFromInvite(byPlayer.get(id));
    if (suggestion) base[id] = { ...EMPTY_ENTRY, status: suggestion };
  }
  return base;
}

/** Sätter samma status på alla spelare i utkastet. */
export function markAll(draft: Draft, status: AttendanceStatus): Draft {
  const next: Draft = {};
  for (const [id, entry] of Object.entries(draft)) next[id] = { ...entry, status };
  return next;
}

export function setEntry(draft: Draft, playerId: string, patch: Partial<DraftEntry>): Draft {
  const current = draft[playerId] ?? { ...EMPTY_ENTRY };
  return { ...draft, [playerId]: { ...current, ...patch } };
}

export function registeredInDraft(draft: Draft): number {
  return Object.values(draft).filter((entry) => entry.status !== null).length;
}

export function counterLabel(draft: Draft, total: number): string {
  return `${registeredInDraft(draft)} av ${total} registrerade`;
}

function sameEntry(a: DraftEntry, b: DraftEntry): boolean {
  return (
    a.status === b.status &&
    (a.minutes ?? null) === (b.minutes ?? null) &&
    (a.reason ?? null) === (b.reason ?? null) &&
    a.note.trim() === b.note.trim()
  );
}

/** Har tränaren osparade ändringar jämfört med det sparade läget? */
export function isDirty(draft: Draft, saved: Draft): boolean {
  const ids = new Set([...Object.keys(draft), ...Object.keys(saved)]);
  for (const id of ids) {
    if (!sameEntry(draft[id] ?? EMPTY_ENTRY, saved[id] ?? EMPTY_ENTRY)) return true;
  }
  return false;
}

/** Har aktiviteten redan någon sparad närvaro? */
export function attendanceStarted(rows: AttendanceRow[]): boolean {
  return rows.length > 0;
}

/** Spelare som saknar registrering – används av filtret Ej registrerade. */
export function unregisteredIds(draft: Draft): string[] {
  return Object.entries(draft)
    .filter(([, entry]) => entry.status === null)
    .map(([id]) => id);
}

export type SavePayload = {
  player_id: string;
  status: AttendanceStatus;
  minutes_played: number | null;
  absence_reason: AbsenceReason | null;
  note: string | null;
};

/** Rader som ska skickas till servern – oregistrerade spelare hoppas över. */
export function toPayload(draft: Draft, eventType: "training" | "match"): SavePayload[] {
  return Object.entries(draft)
    .filter(([, entry]) => entry.status !== null)
    .map(([playerId, entry]) => ({
      player_id: playerId,
      status: entry.status as AttendanceStatus,
      minutes_played: eventType === "match" && entry.status !== "absent" ? entry.minutes : null,
      absence_reason: entry.status === "absent" ? entry.reason : null,
      note: entry.note.trim() ? entry.note.trim() : null,
    }));
}

/** Sparar hela utkastet i en transaktion. Returnerar antal sparade rader. */
export async function saveEventAttendance(input: {
  eventId: string;
  teamId: string;
  rows: SavePayload[];
}): Promise<number> {
  const { data, error } = await supabase.rpc("save_event_attendance", {
    _event_id: input.eventId,
    _team_id: input.teamId,
    _rows: input.rows as unknown as never,
  });
  if (error) throw new Error(error.message);
  return (data as number | null) ?? 0;
}
