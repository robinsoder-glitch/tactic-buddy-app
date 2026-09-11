import type { QueryClient } from "@tanstack/react-query";

/**
 * Kalendern ska visa nya och ändrade aktiviteter direkt efter sparning.
 * Alla frågor som ritar månadsvyn, listan och planeringsstatus uppdateras.
 */
const CALENDAR_KEYS = [
  "month-events",
  "upcoming-events",
  "month-invited",
  "event-invited",
  "event-plans",
  "event-resources",
  "event-squads",
  "event-coaches",
] as const;

export function invalidateCalendar(queryClient: QueryClient) {
  return Promise.all(
    CALENDAR_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  );
}
