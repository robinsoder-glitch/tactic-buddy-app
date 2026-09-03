import { supabase } from "@/integrations/supabase/client";

/** En tränare som är ansvarig för en aktivitet (träning eller match). */
export type EventCoach = {
  id: string;
  event_id: string;
  team_id: string;
  user_id: string;
  note: string | null;
  displayName?: string | null;
};

/** Hämtar ansvariga tränare för en eller flera aktiviteter. */
export async function fetchEventCoaches(eventIds: string[]): Promise<EventCoach[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await supabase
    .from("event_coaches")
    .select("id, event_id, team_id, user_id, note")
    .in("event_id", eventIds)
    .order("created_at");
  if (error) throw error;

  const rows = (data ?? []) as EventCoach[];
  const ids = Array.from(new Set(rows.map((row) => row.user_id)));
  if (ids.length === 0) return rows;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);
  const names = new Map(
    (profiles ?? []).map((row) => [row.id as string, row.display_name as string | null]),
  );
  return rows.map((row) => ({ ...row, displayName: names.get(row.user_id) ?? null }));
}

/** Lägger till en ansvarig tränare på aktiviteten. */
export async function addEventCoach(input: {
  eventId: string;
  teamId: string;
  userId: string;
  createdBy: string;
  note?: string | null;
}) {
  const { error } = await supabase.from("event_coaches").upsert(
    {
      event_id: input.eventId,
      team_id: input.teamId,
      user_id: input.userId,
      created_by: input.createdBy,
      note: input.note?.trim() || null,
    },
    { onConflict: "event_id,user_id" },
  );
  if (error) throw error;
}

/** Tar bort en ansvarig tränare. */
export async function removeEventCoach(id: string) {
  const { error } = await supabase.from("event_coaches").delete().eq("id", id);
  if (error) throw error;
}

/** Visningsnamn för en ansvarig tränare, med eventuellt ansvarsområde. */
export function coachLabel(coach: EventCoach): string {
  const name = coach.displayName?.trim() || "Tränare";
  return coach.note ? `${name} – ${coach.note}` : name;
}

/** Kort sammanfattning i listor, t.ex. "Ansvarig: Anna, Björn". */
export function coachSummary(coaches: EventCoach[]): string {
  if (coaches.length === 0) return "Ingen ansvarig tränare";
  const names = coaches.map((coach) => coach.displayName?.trim() || "Tränare");
  return `Ansvarig: ${names.join(", ")}`;
}
