import type { Drill } from "./taktikbank";

/** Standardlängd i minuter när en övning läggs in i en träning. */
export const DRILL_DEFAULT_MINUTES = 15;

/** Kortaste respektive längsta rekommenderade tid för en övning. */
export function drillDurationRange(drill: Drill): { min: number; max: number } {
  const data = drill.data as { durationMin?: number; durationMax?: number };
  const min = data.durationMin ?? 10;
  const max = data.durationMax ?? 20;
  return min <= max ? { min, max } : { min: max, max: min };
}

/** Etikett av typen "10–20 min". */
export function drillDurationLabel(drill: Drill): string {
  const { min, max } = drillDurationRange(drill);
  return min === max ? `${min} min` : `${min}–${max} min`;
}

/** Föreslagen längd inom övningens intervall. */
export function drillDefaultMinutes(drill: Drill): number {
  const { min, max } = drillDurationRange(drill);
  return Math.min(Math.max(DRILL_DEFAULT_MINUTES, min), max);
}
