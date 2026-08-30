import { supabase } from "@/integrations/supabase/client";

/** Allt innehåll i banken kan kopplas till en aktivitet i kalendern. */
export type PlanKind = "tactic" | "drill" | "session" | "goalkeeper" | "article";

export const PLAN_KIND_LABELS: Record<PlanKind, string> = {
  tactic: "Taktikkort",
  drill: "Övning",
  session: "Träningspass",
  goalkeeper: "Målvaktsövning",
  article: "Artikel",
};

export type PlannableEvent = {
  id: string;
  team_id: string;
  type: "training" | "match";
  title: string | null;
  starts_at: string;
  location: string | null;
  team_name: string | null;
};

/** Kommande träningar och matcher i de lag användaren är med i. */
export async function fetchUpcomingEvents(fromIso = new Date(Date.now() - 3 * 3600_000).toISOString()) {
  const { data, error } = await supabase
    .from("events")
    .select("id, team_id, type, title, starts_at, location, cancelled_at, teams(name)")
    .gte("starts_at", fromIso)
    .is("cancelled_at", null)
    .order("starts_at")
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    team_id: row.team_id as string,
    type: row.type as "training" | "match",
    title: (row.title as string | null) ?? null,
    starts_at: row.starts_at as string,
    location: (row.location as string | null) ?? null,
    team_name: (row as unknown as { teams: { name: string } | null }).teams?.name ?? null,
  })) satisfies PlannableEvent[];
}

/** Lägger innehållet i aktivitetens plan, med planerad tid. */
export async function addResourceToEvent(input: {
  eventId: string;
  teamId: string;
  userId: string;
  kind: PlanKind;
  resourceId: string;
  minutes: number | null;
  note?: string | null;
}) {
  const { error } = await supabase.from("event_resources").upsert(
    {
      event_id: input.eventId,
      team_id: input.teamId,
      created_by: input.userId,
      kind: input.kind,
      resource_id: input.resourceId,
      minutes: input.minutes,
      note: input.note?.trim() || null,
    },
    { onConflict: "event_id,kind,resource_id" },
  );
  if (error) throw error;
}

/** Vänlig etikett för en aktivitet i listan. */
export function eventOptionLabel(event: PlannableEvent): string {
  const date = new Date(event.starts_at);
  const when = date.toLocaleString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const what = event.title?.trim() || (event.type === "match" ? "Match" : "Träning");
  return `${when} · ${what}${event.team_name ? ` · ${event.team_name}` : ""}`;
}

export type SessionEventLink = {
  id: string;
  event_id: string;
  session_id: string;
  starts_at: string;
  type: "training" | "match";
  title: string | null;
  team_id: string;
};

/** Hämtar vilka kalenderaktiviteter ett träningspass är kopplat till. */
export async function fetchSessionLinks(sessionIds: string[]): Promise<SessionEventLink[]> {
  if (sessionIds.length === 0) return [];
  const { data, error } = await supabase
    .from("event_resources")
    .select("id, event_id, resource_id, team_id, events(starts_at, type, title)")
    .eq("kind", "session")
    .in("resource_id", sessionIds);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const event = (row as unknown as { events: { starts_at: string; type: string; title: string | null } | null })
      .events;
    return {
      id: row.id as string,
      event_id: row.event_id as string,
      session_id: row.resource_id as string,
      team_id: row.team_id as string,
      starts_at: event?.starts_at ?? "",
      type: (event?.type as "training" | "match") ?? "training",
      title: event?.title ?? null,
    };
  });
}

/** Tar bort kopplingen mellan ett träningspass och en aktivitet. */
export async function removeSessionLink(id: string) {
  const { error } = await supabase.from("event_resources").delete().eq("id", id);
  if (error) throw error;
}

/** Kort etikett för en koppling, t.ex. "tis 9 sep 17:00 · Träning". */
export function linkLabel(link: SessionEventLink): string {
  const when = link.starts_at
    ? new Date(link.starts_at).toLocaleString("sv-SE", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Okänd tid";
  const what = link.title?.trim() || (link.type === "match" ? "Match" : "Träning");
  return `${when} · ${what}`;
}
