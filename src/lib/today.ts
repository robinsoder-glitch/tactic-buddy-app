/**
 * Hjälpfunktioner för dagsvyn "Idag" på startsidan.
 * Rena funktioner utan databasanrop – enkla att testa.
 */
import type { TeamEvent } from "@/lib/teams";

export type TodayEvent = TeamEvent & { teamName?: string | null };

/** Kommande, ej inställda aktiviteter i tidsordning. */
export function upcomingEvents(
  events: TodayEvent[],
  now: Date = new Date(),
  limit = 3,
): TodayEvent[] {
  return events
    .filter((event) => !event.cancelled_at)
    .filter((event) => new Date(event.starts_at).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, limit);
}

/** Kommande aktiviteter som saknar sparad planering. */
export function eventsMissingPlan(
  events: TodayEvent[],
  plannedEventIds: string[],
  now: Date = new Date(),
): TodayEvent[] {
  const planned = new Set(plannedEventIds);
  return upcomingEvents(events, now, Number.MAX_SAFE_INTEGER).filter(
    (event) => !planned.has(event.id),
  );
}

/** Svensk rubrik för en aktivitet i dagsvyn. */
export function todayEventTitle(event: TodayEvent): string {
  if (event.title) return event.title;
  if (event.type === "match") {
    const home = event.home_team?.trim();
    const away = event.away_team?.trim();
    if (home && away) return `${home} – ${away}`;
    return "Match";
  }
  return "Träning";
}
