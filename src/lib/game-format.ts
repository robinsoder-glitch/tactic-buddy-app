import type { PitchType } from "@/lib/tactics";

/** Spelformer i modern svensk text, så som förbundet skriver dem. */
export type GameFormatId = "5v5" | "7v7" | "9v9" | "11v11";

export type GameFormat = {
  id: GameFormatId;
  /** Text som visas för tränaren, t.ex. "5 mot 5". */
  label: string;
  /** Kort förklaring av vilken ålder spelformen brukar gälla. */
  hint: string;
  /** Vilken planstorlek tavlan ritar upp. */
  pitchType: PitchType;
};

export const GAME_FORMATS: GameFormat[] = [
  { id: "5v5", label: "5 mot 5", hint: "Ungefär 8–9 år", pitchType: "five" },
  { id: "7v7", label: "7 mot 7", hint: "Ungefär 10–12 år", pitchType: "seven" },
  { id: "9v9", label: "9 mot 9", hint: "Ungefär 13–14 år", pitchType: "nine" },
  { id: "11v11", label: "11 mot 11", hint: "Från ungefär 15 år", pitchType: "full" },
];

export function pitchTypeForFormat(id: GameFormatId): PitchType {
  return GAME_FORMATS.find((format) => format.id === id)?.pitchType ?? "small";
}

export function gameFormatLabel(id: GameFormatId): string {
  return GAME_FORMATS.find((format) => format.id === id)?.label ?? id;
}

/** Tolkar spelform ur bankens textfält, t.ex. "5v5", "5 mot 5" eller "11-manna". */
export function parseGameFormat(value: string | null | undefined): GameFormatId | null {
  if (!value) return null;
  const text = value.toLowerCase().replace(/\s+/g, "");
  for (const format of GAME_FORMATS) {
    const digits = format.id.split("v")[0];
    if (
      text.includes(format.id) ||
      text.includes(`${digits}mot${digits}`) ||
      text.includes(`${digits}-manna`) ||
      text.includes(`${digits}manna`)
    ) {
      return format.id;
    }
  }
  return null;
}

/** Modern svensk text för planstorleken på ett taktikkort. */
export function pitchTypeLabel(pitchType: PitchType): string {
  if (pitchType === "full") return "11 mot 11";
  if (pitchType === "nine") return "9 mot 9";
  if (pitchType === "seven") return "7 mot 7";
  if (pitchType === "five") return "5 mot 5";
  return "5 mot 5 / 7 mot 7";
}

/** Spelform som hör ihop med en planstorlek. */
export function formatForPitchType(pitchType: PitchType): GameFormatId | null {
  return GAME_FORMATS.find((format) => format.pitchType === pitchType)?.id ?? null;
}
