import type { Drawing, FieldObject, Frame, PitchType } from "./tactics";

export type TacticFile = {
  format: "taktiktavlan";
  version: 1;
  name: string;
  pitchType: PitchType;
  frames: Frame[];
};

export function buildTacticFile(name: string, pitchType: PitchType, frames: Frame[]): TacticFile {
  return { format: "taktiktavlan", version: 1, name, pitchType, frames };
}

export function downloadTacticFile(name: string, pitchType: PitchType, frames: Frame[]) {
  const data = JSON.stringify(buildTacticFile(name, pitchType, frames), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const slug = name.replace(/[^a-z0-9åäö]+/gi, "-").toLowerCase() || "taktik";
  link.href = url;
  link.download = `${slug}.taktik.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Parses and validates a .taktik.json file. Throws a readable Swedish error. */
export function parseTacticFile(raw: string): TacticFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Filen kunde inte läsas – den är inte en giltig taktikfil.");
  }
  if (!isRecord(parsed) || parsed['format'] !== "taktiktavlan") {
    throw new Error("Fel filformat. Välj en fil som exporterats från Taktiktavlan.");
  }
  const pitchType = parsed['pitchType'] === "full" ? "full" : "small";
  const framesRaw = Array.isArray(parsed['frames']) ? parsed['frames'] : [];
  const frames: Frame[] = framesRaw.filter(isRecord).map((frame, index) => ({
    id: typeof frame['id'] === "string" ? frame['id'] : crypto.randomUUID(),
    name: typeof frame['name'] === "string" ? frame['name'] : `Steg ${index + 1}`,
    note: typeof frame['note'] === "string" ? frame['note'] : null,
    objects: (Array.isArray(frame['objects']) ? frame['objects'] : []) as FieldObject[],
    drawings: (Array.isArray(frame['drawings']) ? frame['drawings'] : []) as Drawing[],
  }));
  if (frames.length === 0) {
    throw new Error("Taktikfilen innehåller inga steg.");
  }
  return {
    format: "taktiktavlan",
    version: 1,
    name: typeof parsed['name'] === "string" && parsed['name'].trim() ? parsed['name'].trim() : "Importerad taktik",
    pitchType,
    frames,
  };
}
