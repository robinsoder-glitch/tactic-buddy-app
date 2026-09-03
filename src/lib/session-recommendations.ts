/**
 * Etapp 7 – regelbaserade rekommendationer.
 * Inga svarta lådor: varje förslag får en kort svensk motivering.
 */
import type { Drill } from "./taktikbank";
import type { TemplateCard } from "./session-templates";

export type ProgressionStep = 1 | 2 | 3 | 4;

export const STEP_LABELS: Record<ProgressionStep, string> = {
  1: "Introducera",
  2: "Öva",
  3: "Använd i spel",
  4: "Följ upp",
};

export type RecommendationInput = {
  ageGroup?: string | null;
  gameFormat?: string | null;
  minutes?: number | null;
  theme?: string | null;
  step?: ProgressionStep | null;
  focus?: string | null;
};

export type Recommendation<T> = {
  item: T;
  score: number;
  reason: string;
};

export const MAX_DRILLS = 3;
export const MAX_TEMPLATES = 2;

/** Plockar ut åldern ur t.ex. "P10" eller "F 9". */
export function ageFromGroup(ageGroup: string | null | undefined): number | null {
  if (!ageGroup) return null;
  const match = ageGroup.match(/(\d{1,2})/);
  if (!match) return null;
  const age = Number(match[1]);
  return Number.isFinite(age) && age > 3 && age < 25 ? age : null;
}

function normalise(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().trim();
}

function matchesText(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return haystack.includes(needle);
}

/** Poängsätter en övning mot lagets förutsättningar. */
export function scoreDrill(drill: Drill, input: RecommendationInput) {
  const reasons: string[] = [];
  let score = 0;
  const text = normalise(
    `${drill.title} ${drill.purpose ?? ""} ${(drill.data?.coachingPoints ?? []).join(" ")}`,
  );

  const format = normalise(input.gameFormat);
  if (format && normalise(drill.data?.format) === format) {
    score += 3;
    reasons.push(`laget spelar ${input.gameFormat}`);
  }

  const age = ageFromGroup(input.ageGroup);
  const fit = drill.data?.ageFit;
  if (age && fit && age >= fit.min && age <= fit.max) {
    score += 2;
    reasons.push(`övningen passar ${age} år`);
  }

  const theme = normalise(input.theme);
  if (theme && matchesText(text, theme)) {
    score += 3;
    reasons.push(`periodens tema är ${input.theme}`);
  }

  const focus = normalise(input.focus);
  if (focus && matchesText(text, focus)) {
    score += 2;
    reasons.push(`ditt fokus är ${input.focus}`);
  }

  // Progressionssteget finjusterar bara övningar som redan matchar laget.
  if (input.step && score > 0) {
    const minutes = drill.default_minutes ?? 10;
    const shortDrill = minutes <= 12;
    if ((input.step === 1 || input.step === 2) && shortDrill) {
      score += 1;
      reasons.push(`steget är ${STEP_LABELS[input.step]} och övningen är kort`);
    }
    if ((input.step === 3 || input.step === 4) && !shortDrill) {
      score += 1;
      reasons.push(`steget är ${STEP_LABELS[input.step]} och övningen är spelnära`);
    }
  }

  return { score, reasons };
}

export function reasonText(reasons: string[]): string {
  if (reasons.length === 0) return "Passar som ett allmänt komplement till träningen.";
  return `Passar eftersom ${reasons.slice(0, 2).join(" och ")}.`;
}

export function recommendDrills(
  drills: Drill[],
  input: RecommendationInput,
  limit = MAX_DRILLS,
): Recommendation<Drill>[] {
  return drills
    .map((drill) => {
      const { score, reasons } = scoreDrill(drill, input);
      return { item: drill, score, reason: reasonText(reasons) };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "sv"))
    .slice(0, limit);
}

export function scoreTemplate(card: TemplateCard, input: RecommendationInput) {
  const reasons: string[] = [];
  let score = 0;

  if (input.gameFormat && normalise(card.gameFormat) === normalise(input.gameFormat)) {
    score += 3;
    reasons.push(`mallen är skriven för ${input.gameFormat}`);
  }
  if (input.ageGroup && normalise(card.ageGroup) === normalise(input.ageGroup)) {
    score += 2;
    reasons.push(`åldersgruppen är ${input.ageGroup}`);
  }
  if (input.theme && matchesText(normalise(`${card.title} ${card.theme ?? ""}`), normalise(input.theme))) {
    score += 3;
    reasons.push(`temat är ${input.theme}`);
  }
  if (input.minutes && card.minutes > 0 && Math.abs(card.minutes - input.minutes) <= 10) {
    score += 1;
    reasons.push(`tiden ligger nära ${input.minutes} minuter`);
  }
  return { score, reasons };
}

export function recommendTemplates(
  cards: TemplateCard[],
  input: RecommendationInput,
  limit = MAX_TEMPLATES,
): Recommendation<TemplateCard>[] {
  return cards
    .map((card) => {
      const { score, reasons } = scoreTemplate(card, input);
      return { item: card, score, reason: reasonText(reasons) };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "sv"))
    .slice(0, limit);
}

/** Kunskapsartiklar visas som läsning inför träningen, aldrig som en del av passet. */
export const READ_BEFORE_LABEL = "Läs inför träningen";
