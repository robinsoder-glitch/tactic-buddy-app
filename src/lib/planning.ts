import { supabase } from "@/integrations/supabase/client";
import type { PlannableEvent } from "@/lib/event-planning";

/** Kommande aktiviteter av en viss typ, hämtade ur lagets befintliga kalender. */
export function upcomingOfType(events: PlannableEvent[], type: "training" | "match"): PlannableEvent[] {
  return events.filter((event) => event.type === type);
}

/** Lägg till eller ta bort en spelare i uttagningen. */
export function toggleSelection(selected: string[], playerId: string): string[] {
  return selected.includes(playerId)
    ? selected.filter((id) => id !== playerId)
    : [...selected, playerId];
}

/** Text som visar hur många spelare som är valda. */
export function selectionLabel(count: number): string {
  return `Valda spelare: ${count}`;
}

/** Kort text om aktiviteten redan har ett planerat innehåll. */
export function plannedLabel(count: number): string {
  return count > 0 ? `Planerat innehåll: ${count} delar` : "Ingen planering ännu";
}

/** Summerar planerad tid i minuter. */
export function sumMinutes(items: { minutes: number | null }[]): number {
  return items.reduce((total, item) => total + (item.minutes ?? 0), 0);
}

export type EventPlan = { event_id: string; team_id: string; notes: string | null };

export async function fetchEventPlan(eventId: string): Promise<EventPlan | null> {
  const { data, error } = await supabase
    .from("event_plans")
    .select("event_id, team_id, notes")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return (data as EventPlan | null) ?? null;
}

export async function saveEventPlan(input: {
  eventId: string;
  teamId: string;
  userId: string;
  notes: string | null;
}) {
  const { error } = await supabase.from("event_plans").upsert(
    {
      event_id: input.eventId,
      team_id: input.teamId,
      created_by: input.userId,
      notes: input.notes?.trim() || null,
    },
    { onConflict: "event_id" },
  );
  if (error) throw error;
}

/** Uttagna spelare för en match. Påverkar aldrig kallelser eller närvaro. */
export async function fetchSquad(eventId: string): Promise<string[]> {
  const { data, error } = await supabase.from("event_squad").select("player_id").eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []).map((row) => row.player_id as string);
}

export async function saveSquad(input: {
  eventId: string;
  teamId: string;
  userId: string;
  playerIds: string[];
}) {
  const { error: removeError } = await supabase.from("event_squad").delete().eq("event_id", input.eventId);
  if (removeError) throw removeError;
  if (input.playerIds.length === 0) return;
  const { error } = await supabase.from("event_squad").insert(
    input.playerIds.map((playerId) => ({
      event_id: input.eventId,
      team_id: input.teamId,
      player_id: playerId,
      created_by: input.userId,
    })),
  );
  if (error) throw error;
}

export type EventResourceRow = {
  id: string;
  event_id: string;
  kind: string;
  resource_id: string;
  minutes: number | null;
  note: string | null;
  sort_order: number;
};

/** Planerat innehåll för en eller flera aktiviteter. */
export async function fetchEventResources(eventIds: string[]): Promise<EventResourceRow[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await supabase
    .from("event_resources")
    .select("id, event_id, kind, resource_id, minutes, note, sort_order")
    .in("event_id", eventIds)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as EventResourceRow[];
}

export async function removeEventResource(id: string) {
  const { error } = await supabase.from("event_resources").delete().eq("id", id);
  if (error) throw error;
}

/** Flyttar en del upp eller ner i planeringen. */
export async function moveEventResource(rows: EventResourceRow[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= rows.length) return;
  const a = rows[index]!;
  const b = rows[target]!;
  await supabase.from("event_resources").update({ sort_order: b.sort_order }).eq("id", a.id);
  await supabase.from("event_resources").update({ sort_order: a.sort_order }).eq("id", b.id);
}
