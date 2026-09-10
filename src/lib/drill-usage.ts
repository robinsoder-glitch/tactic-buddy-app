import { supabase } from "@/integrations/supabase/client";

/** En plats där övningen används: ett träningspass, en aktivitet eller ett genomfört pass. */
export type DrillUsage = {
  id: string;
  source: "session" | "event" | "run";
  title: string;
  date: string | null;
  /** Sant när övningen faktiskt är genomförd (avbockad i ett kört pass). */
  done: boolean;
};

/** Kort sammanfattning som visas överst i listan. */
export function usageSummary(rows: DrillUsage[]): string {
  if (rows.length === 0) return "Du har inte använt övningen ännu.";
  const planned = rows.filter((row) => row.source !== "run").length;
  const done = rows.filter((row) => row.done).length;
  const parts = [
    planned === 1 ? "Planerad 1 gång" : `Planerad ${planned} gånger`,
    done === 1 ? "genomförd 1 gång" : `genomförd ${done} gånger`,
  ];
  return `${parts.join(", ")}.`;
}

/** Nyaste först, rader utan datum sist. */
export function sortUsage(rows: DrillUsage[]): DrillUsage[] {
  return [...rows].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });
}

export function usageDateLabel(date: string | null): string {
  if (!date) return "Utan datum";
  return new Date(date).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Hämtar var övningen används och om den har genomförts. Visar bara sådant du får se. */
export async function fetchDrillUsage(drillId: string): Promise<DrillUsage[]> {
  const [sessions, events, runs] = await Promise.all([
    supabase
      .from("coach_session_items")
      .select("id, title, coach_sessions(title, session_date, updated_at)")
      .eq("kind", "drill")
      .eq("resource_id", drillId),
    supabase
      .from("event_resources")
      .select("id, events(title, type, starts_at)")
      .eq("kind", "drill")
      .eq("resource_id", drillId),
    supabase
      .from("session_run_items")
      .select("id, title, status, session_runs(started_at)")
      .eq("resource_id", drillId),
  ]);

  // Ett databasfel får aldrig se ut som "aldrig använd" – då visar sidan fel.
  const failed = [sessions.error, events.error, runs.error].find(Boolean);
  if (failed) throw failed;

  const rows: DrillUsage[] = [];

  for (const row of sessions.data ?? []) {
    const parent = (
      row as unknown as {
        coach_sessions: { title: string; session_date: string | null; updated_at: string } | null;
      }
    ).coach_sessions;
    rows.push({
      id: `session:${row.id as string}`,
      source: "session",
      title: parent?.title ?? "Träningspass",
      date: parent?.session_date ?? parent?.updated_at ?? null,
      done: false,
    });
  }

  for (const row of events.data ?? []) {
    const parent = (
      row as unknown as {
        events: { title: string | null; type: string; starts_at: string } | null;
      }
    ).events;
    rows.push({
      id: `event:${row.id as string}`,
      source: "event",
      title: parent?.title?.trim() || (parent?.type === "match" ? "Match" : "Träning"),
      date: parent?.starts_at ?? null,
      done: false,
    });
  }

  for (const row of runs.data ?? []) {
    const parent = (row as unknown as { session_runs: { started_at: string } | null }).session_runs;
    rows.push({
      id: `run:${row.id as string}`,
      source: "run",
      title: (row.title as string) || "Genomfört pass",
      date: parent?.started_at ?? null,
      done: (row.status as string) === "done",
    });
  }

  return sortUsage(rows);
}

export const USAGE_SOURCE_LABELS: Record<DrillUsage["source"], string> = {
  session: "Träningspass",
  event: "Inplanerad aktivitet",
  run: "Genomfört pass",
};
