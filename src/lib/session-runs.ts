import { supabase } from "@/integrations/supabase/client";
import { fetchCoachSession, fetchSessionItems } from "./coach-sessions";

/** Ett pågående eller avslutat genomförande av ett träningspass. */
export type SessionRun = {
  id: string;
  session_id: string;
  team_id: string | null;
  event_id: string | null;
  coach_id: string;
  status: "active" | "done" | "abandoned";
  started_at: string;
  ended_at: string | null;
  paused_at: string | null;
  paused_seconds: number;
  adjust_seconds: number;
  current_index: number;
  general_note: string | null;
};

export type SessionRunItem = {
  id: string;
  run_id: string;
  item_id: string | null;
  kind: string;
  title: string;
  resource_id: string | null;
  planned_minutes: number;
  actual_seconds: number;
  status: "pending" | "done" | "skipped";
  note: string | null;
  sort_order: number;
};

export type RunAttendanceStatus = "present" | "partial" | "absent";

export type RunAttendanceRow = { player_id: string; status: RunAttendanceStatus };
export type RunPlayerNote = { player_id: string; note: string };

const RUN_COLUMNS =
  "id, session_id, team_id, event_id, coach_id, status, started_at, ended_at, paused_at, paused_seconds, adjust_seconds, current_index, general_note";
const RUN_ITEM_COLUMNS =
  "id, run_id, item_id, kind, title, resource_id, planned_minutes, actual_seconds, status, note, sort_order";

/* ---------- Rena hjälpfunktioner (testbara utan databas) ---------- */

/** Total tid som genomförandet har pågått, exklusive pauser. */
export function runElapsedSeconds(
  run: Pick<SessionRun, "started_at" | "paused_at" | "paused_seconds" | "ended_at">,
  nowMs: number,
): number {
  const start = Date.parse(run.started_at);
  const end = run.ended_at ? Date.parse(run.ended_at) : nowMs;
  const pausedNow = run.paused_at ? Math.max(0, (end - Date.parse(run.paused_at)) / 1000) : 0;
  const total = (end - start) / 1000 - run.paused_seconds - pausedNow;
  return Math.max(0, Math.floor(total));
}

/** Hur länge det aktuella momentet har pågått. */
export function currentItemSeconds(
  run: Pick<
    SessionRun,
    "started_at" | "paused_at" | "paused_seconds" | "ended_at" | "current_index"
  >,
  items: Pick<SessionRunItem, "actual_seconds">[],
  nowMs: number,
): number {
  const before = items
    .slice(0, run.current_index)
    .reduce((sum, item) => sum + item.actual_seconds, 0);
  return Math.max(0, runElapsedSeconds(run, nowMs) - before);
}

/** Tid kvar av momentet. Negativt tal betyder övertid. */
export function remainingSeconds(plannedMinutes: number, elapsedSeconds: number): number {
  return plannedMinutes * 60 - elapsedSeconds;
}

/** Visar sekunder som mm:ss (eller h:mm:ss för långa pass). */
export function formatClock(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const total = Math.abs(Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0
    ? `${sign}${hours}:${pad(minutes)}:${pad(secs)}`
    : `${sign}${pad(minutes)}:${pad(secs)}`;
}

/** Sammanfattning efter avslutat pass. */
export function runSummary(
  items: Pick<SessionRunItem, "planned_minutes" | "actual_seconds" | "status">[],
) {
  const planned = items.reduce((sum, item) => sum + item.planned_minutes * 60, 0);
  const actual = items.reduce((sum, item) => sum + item.actual_seconds, 0);
  return {
    plannedSeconds: planned,
    actualSeconds: actual,
    done: items.filter((item) => item.status === "done").length,
    skipped: items.filter((item) => item.status === "skipped").length,
    diffSeconds: actual - planned,
  };
}

/* ---------- Databas ---------- */

/** Det pågående genomförandet för ett pass, om det finns ett. */
export async function fetchActiveRun(sessionId: string): Promise<SessionRun | null> {
  const { data, error } = await supabase
    .from("session_runs")
    .select(RUN_COLUMNS)
    .eq("session_id", sessionId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as SessionRun | null;
}

export async function fetchRun(runId: string): Promise<SessionRun | null> {
  const { data, error } = await supabase
    .from("session_runs")
    .select(RUN_COLUMNS)
    .eq("id", runId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as SessionRun | null;
}

export async function fetchRunItems(runId: string): Promise<SessionRunItem[]> {
  const { data, error } = await supabase
    .from("session_run_items")
    .select(RUN_ITEM_COLUMNS)
    .eq("run_id", runId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as SessionRunItem[];
}

/**
 * Startar ett genomförande. Finns redan ett pågående returneras det i stället,
 * så att det aldrig kan finnas två aktiva genomföranden av samma pass.
 */
export async function startRun(sessionId: string, eventId?: string | null): Promise<SessionRun> {
  const existing = await fetchActiveRun(sessionId);
  if (existing) return existing;

  const [session, items] = await Promise.all([
    fetchCoachSession(sessionId),
    fetchSessionItems(sessionId),
  ]);
  if (!session) throw new Error("Träningspasset kunde inte hittas.");
  if (items.length === 0)
    throw new Error("Passet saknar innehåll. Lägg till minst en del innan du startar.");

  const { data, error } = await supabase
    .from("session_runs")
    .insert({ session_id: sessionId, team_id: session.team_id, event_id: eventId ?? null })
    .select(RUN_COLUMNS)
    .single();
  if (error) throw error;
  const run = data as unknown as SessionRun;

  const { error: itemError } = await supabase.from("session_run_items").insert(
    items.map((item, index) => ({
      run_id: run.id,
      item_id: item.id,
      kind: item.kind,
      title: item.title,
      resource_id: item.resource_id,
      planned_minutes: item.minutes,
      sort_order: index,
    })),
  );
  if (itemError) throw itemError;
  return run;
}

export async function patchRun(runId: string, patch: Partial<SessionRun>) {
  const { error } = await supabase.from("session_runs").update(patch).eq("id", runId);
  if (error) throw error;
}

export async function patchRunItem(itemId: string, patch: Partial<SessionRunItem>) {
  const { error } = await supabase.from("session_run_items").update(patch).eq("id", itemId);
  if (error) throw error;
}

/** Pausar och sparar hur länge pausen har varat när den återupptas. */
export async function pauseRun(run: SessionRun) {
  if (run.paused_at) return;
  await patchRun(run.id, { paused_at: new Date().toISOString() });
}

export async function resumeRun(run: SessionRun) {
  if (!run.paused_at) return;
  const extra = Math.max(0, Math.round((Date.now() - Date.parse(run.paused_at)) / 1000));
  await patchRun(run.id, { paused_at: null, paused_seconds: run.paused_seconds + extra });
}

/** Byter moment och sparar den faktiska tiden för det moment man lämnar. */
export async function goToItem(input: {
  run: SessionRun;
  items: SessionRunItem[];
  nextIndex: number;
  leaveStatus: "done" | "skipped" | "pending";
}) {
  const { run, items, nextIndex, leaveStatus } = input;
  const current = items[run.current_index];
  const index = Math.max(0, Math.min(items.length - 1, nextIndex));
  if (current && nextIndex > run.current_index) {
    const seconds = currentItemSeconds(run, items, Date.now());
    await patchRunItem(current.id, { actual_seconds: Math.round(seconds), status: leaveStatus });
  }
  await patchRun(run.id, { current_index: index });
}

/** Lägger en minut till det aktuella momentet. */
export async function addMinute(item: SessionRunItem) {
  await patchRunItem(item.id, { planned_minutes: item.planned_minutes + 1 });
}

export async function fetchRunAttendance(runId: string): Promise<RunAttendanceRow[]> {
  const { data, error } = await supabase
    .from("session_run_attendance")
    .select("player_id, status")
    .eq("run_id", runId);
  if (error) throw error;
  return (data ?? []) as unknown as RunAttendanceRow[];
}

export async function setRunAttendance(
  runId: string,
  playerId: string,
  status: RunAttendanceStatus,
) {
  const { error } = await supabase.from("session_run_attendance").upsert(
    { run_id: runId, player_id: playerId, status, updated_at: new Date().toISOString() },
    {
      onConflict: "run_id,player_id",
    },
  );
  if (error) throw error;
}

export async function fetchRunPlayerNotes(runId: string): Promise<RunPlayerNote[]> {
  const { data, error } = await supabase
    .from("session_run_player_notes")
    .select("player_id, note")
    .eq("run_id", runId);
  if (error) throw error;
  return (data ?? []) as unknown as RunPlayerNote[];
}

export async function setRunPlayerNote(runId: string, playerId: string, note: string) {
  const { error } = await supabase
    .from("session_run_player_notes")
    .upsert(
      { run_id: runId, player_id: playerId, note, updated_at: new Date().toISOString() },
      { onConflict: "run_id,player_id" },
    );
  if (error) throw error;
}

/**
 * Avslutar genomförandet: sparar tiden för det sista momentet, sätter sluttid
 * och markerar passet som genomfört. Närvaron speglas till lagets aktivitet
 * när passet är kopplat till en träning i kalendern.
 */
export async function finishRun(input: {
  run: SessionRun;
  items: SessionRunItem[];
  userId: string;
}) {
  const { run, items, userId } = input;
  const current = items[run.current_index];
  if (current && current.status === "pending") {
    const seconds = currentItemSeconds(run, items, Date.now());
    await patchRunItem(current.id, { actual_seconds: Math.round(seconds), status: "done" });
  }
  await patchRun(run.id, {
    status: "done",
    ended_at: new Date().toISOString(),
    paused_at: null,
  });
  const { error } = await supabase
    .from("coach_sessions")
    .update({ status: "done" })
    .eq("id", run.session_id);
  if (error) throw error;

  if (run.event_id && run.team_id) {
    const attendance = await fetchRunAttendance(run.id);
    if (attendance.length > 0) {
      const { error: attendanceError } = await supabase.from("event_attendance").upsert(
        attendance.map((row) => ({
          event_id: run.event_id as string,
          team_id: run.team_id as string,
          player_id: row.player_id,
          status: row.status,
          created_by: userId,
          registered_by: userId,
          updated_by: userId,
        })),
        { onConflict: "event_id,player_id" },
      );
      if (attendanceError) throw attendanceError;
    }
  }
}
