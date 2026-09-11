import { supabase } from "@/integrations/supabase/client";

/** Tre lägen som tränaren känner igen: planerad, skickad (kallelser ute) och spelad. */
export type MatchStatus = "planerad" | "skickad" | "spelad";

export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  planerad: "Planerad",
  skickad: "Kallelser skickade",
  spelad: "Spelad",
};

export const MATCH_STATUS_ORDER: MatchStatus[] = ["planerad", "skickad", "spelad"];

export function matchStatusClasses(status: MatchStatus): string {
  if (status === "spelad") return "bg-sky-500/15 text-sky-700 dark:text-sky-300";
  if (status === "skickad") return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
}

export function isMatchStatus(value: unknown): value is MatchStatus {
  return value === "planerad" || value === "skickad" || value === "spelad";
}

/**
 * Tränarens egna val vinner alltid. Annars: spelad när starttiden passerat,
 * skickad när kallelser finns, i övrigt planerad.
 */
export function matchStatus(input: {
  override?: string | null;
  startsAt: string;
  hasInvitations: boolean;
  now?: Date;
}): MatchStatus {
  if (isMatchStatus(input.override)) return input.override;
  const now = input.now ?? new Date();
  if (new Date(input.startsAt).getTime() < now.getTime()) return "spelad";
  return input.hasInvitations ? "skickad" : "planerad";
}

/** Vilka matcher som redan har minst en aktiv kallelse. */
export async function fetchEventsWithInvitations(eventIds: string[]): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("event_invitations")
    .select("event_id")
    .in("event_id", eventIds)
    .is("revoked_at", null);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.event_id as string));
}

/** Sparar tränarens val. Tomt val betyder att appen räknar ut statusen igen. */
export async function setMatchStatus(eventId: string, status: MatchStatus | null) {
  const { error } = await supabase
    .from("events")
    .update({ match_status: status })
    .eq("id", eventId);
  if (error) throw new Error(error.message);
}
