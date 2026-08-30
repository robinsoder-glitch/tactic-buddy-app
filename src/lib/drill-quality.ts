import type { Drill, DrillData } from "./taktikbank";

/** Fälten som en färdig övning i Övningsbanken måste innehålla (full mall). */
export const REQUIRED_DRILL_FIELDS = [
  "purpose",
  "format",
  "ageFit",
  "area",
  "players",
  "equipment",
  "organisation",
  "execution",
  "coachingPoints",
  "simplify",
  "challenge",
  "defaultMinutes",
] as const;

export type RequiredDrillField = (typeof REQUIRED_DRILL_FIELDS)[number];

export const DRILL_FIELD_LABELS: Record<RequiredDrillField, string> = {
  purpose: "Syfte",
  format: "Spelform",
  ageFit: "Ålder",
  area: "Yta",
  players: "Antal spelare",
  equipment: "Utrustning",
  organisation: "Organisation",
  execution: "Genomförande",
  coachingPoints: "Coachpunkter",
  simplify: "Förenkla",
  challenge: "Utmana",
  defaultMinutes: "Tid",
};

function hasValue(data: DrillData, field: RequiredDrillField): boolean {
  const value = data[field];
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return value > 0;
  if (field === "ageFit") {
    const fit = value as { min?: number; max?: number };
    return typeof fit.min === "number" && typeof fit.max === "number" && fit.max >= fit.min;
  }
  return true;
}

/** Returnerar de obligatoriska fält som saknas i övningen. */
export function missingDrillFields(drill: Pick<Drill, "data">): RequiredDrillField[] {
  return REQUIRED_DRILL_FIELDS.filter((field) => !hasValue(drill.data, field));
}

/** True när övningen följer hela mallen. */
export function isDrillComplete(drill: Pick<Drill, "data">): boolean {
  return missingDrillFields(drill).length === 0;
}
