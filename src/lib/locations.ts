import type { TeamEvent } from "./teams";

type LocationSource = Pick<TeamEvent, "location" | "starts_at">;

/**
 * Platser laget faktiskt har använt, med den vanligaste och senaste först.
 * Tomma platser hoppas över och stavning med olika versaler räknas som samma plats.
 */
export function recentLocations(events: LocationSource[], limit = 8): string[] {
  const seen = new Map<string, { label: string; count: number; latest: number }>();

  for (const event of events) {
    const label = (event.location ?? "").trim();
    if (!label) continue;
    const key = label.toLocaleLowerCase("sv-SE");
    const time = event.starts_at ? new Date(event.starts_at).getTime() : 0;
    const previous = seen.get(key);
    if (previous) {
      previous.count += 1;
      if (Number.isFinite(time) && time > previous.latest) {
        previous.latest = time;
        previous.label = label;
      }
    } else {
      seen.set(key, { label, count: 1, latest: Number.isFinite(time) ? time : 0 });
    }
  }

  return [...seen.values()]
    .sort((a, b) => b.count - a.count || b.latest - a.latest || a.label.localeCompare(b.label, "sv"))
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.label);
}
