import type { Drill, DrillData, GoalkeeperCard } from "@/lib/taktikbank";

export const TRAINING_FOCUS_AREAS = [
  "Passningar och mottagning",
  "Dribbling och bollkontroll",
  "Avslut",
  "Spelbarhet och rörelse",
  "Försvarsspel",
  "Press och återerövring",
  "Omställningar",
  "Målvakt",
  "Spelförståelse",
  "Samarbete och kommunikation",
] as const;

export type TrainingFocusArea = (typeof TRAINING_FOCUS_AREAS)[number];

export type ExerciseGuideData = {
  purpose?: string;
  area?: string;
  players?: string;
  equipment?: string[];
  organisation?: string[];
  execution?: string[];
  coachingPoints?: string[];
  coachQuestions?: string[];
  simplify?: string[];
  challenge?: string[];
  successSigns?: string[];
  safety?: string;
};

export function toggleFocus(areas: string[], area: string): string[] {
  return areas.includes(area) ? areas.filter((item) => item !== area) : [...areas, area];
}

export function focusAreasWithLegacy(focusAreas: string[], theme: string | null): string[] {
  if (focusAreas.length > 0) return focusAreas;
  if (!theme?.trim()) return [];
  const normalized = theme.toLocaleLowerCase("sv-SE");
  const matched = TRAINING_FOCUS_AREAS.filter((area) => {
    const stem = area.split(" och ")[0]?.toLocaleLowerCase("sv-SE") ?? "";
    return normalized.includes(stem) || stem.includes(normalized);
  });
  return matched.length > 0 ? matched : [theme.trim()];
}

export function drillGuide(drill: Drill): ExerciseGuideData {
  const data: DrillData = drill.data;
  return {
    purpose: data.purpose ?? drill.purpose ?? undefined,
    area: data.area,
    players: data.players,
    equipment: data.equipment,
    organisation: data.organisation,
    execution: data.execution,
    coachingPoints: data.coachingPoints,
    coachQuestions: data.coachQuestions,
    simplify: data.simplify,
    challenge: data.challenge,
    successSigns: data.successSigns,
    safety: data.safety,
  };
}

export function goalkeeperGuide(card: GoalkeeperCard): ExerciseGuideData {
  return {
    purpose: card.data.purpose ?? card.purpose ?? undefined,
    execution: card.data.steps,
    coachingPoints: card.data.childCues,
    coachQuestions: card.data.coachQuestions,
    successSigns: card.data.successSigns,
  };
}

export function lines(value: string): string[] | undefined {
  const result = value
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
  return result.length ? result : undefined;
}

export function guideHasContent(guide: ExerciseGuideData | null | undefined): boolean {
  if (!guide) return false;
  return Object.values(guide).some((value) =>
    Array.isArray(value) ? value.length > 0 : Boolean(value?.trim()),
  );
}