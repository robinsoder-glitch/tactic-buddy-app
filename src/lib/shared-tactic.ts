/**
 * Publikt (delat) taktikinnehåll. Databasen anonymiserar redan innehållet, men
 * vi tolkar svaret strikt här också så att inga spelaruppgifter kan slinka med.
 */
import type { Drawing, FieldObject, Frame, PitchType } from "./tactics";

export type SharedTactic = {
  id: string;
  name: string;
  pitch_type: PitchType;
  frames: Frame[];
};

type Loose = Record<string, unknown>;

function publicObject(raw: Loose, fallbackLabel: string): FieldObject {
  const kind = (raw.kind as FieldObject["kind"]) ?? "player";
  const number = typeof raw.number === "number" ? raw.number : null;
  return {
    id: String(raw.id ?? ""),
    kind,
    label: kind === "player" ? String(raw.label ?? fallbackLabel) : String(raw.label ?? ""),
    number,
    team: (raw.team as FieldObject["team"]) ?? "home",
    ...(raw.gk === true ? { gk: true } : {}),
    x: Number(raw.x ?? 0),
    y: Number(raw.y ?? 0),
  };
}

/** Tolkar svaret från den säkra databasfunktionen. Kastar om taktiken inte delas. */
export function parseSharedTactic(payload: unknown): SharedTactic {
  const data = payload as Loose | null;
  if (!data || typeof data !== "object" || !data.id) {
    throw new Error("Taktiken är inte delad eller finns inte.");
  }
  const labels = new Map<string, string>();
  const frames = (Array.isArray(data.frames) ? data.frames : []).map((frameRaw) => {
    const frame = frameRaw as Loose;
    const objects = (Array.isArray(frame.objects) ? frame.objects : []).map((objectRaw) => {
      const raw = objectRaw as Loose;
      const id = String(raw.id ?? "");
      if ((raw.kind ?? "player") === "player" && !labels.has(id)) {
        labels.set(id, `Spelare ${labels.size + 1}`);
      }
      return publicObject(raw, labels.get(id) ?? "Spelare");
    });
    return {
      id: String(frame.id ?? ""),
      name: (frame.name as string | null) ?? null,
      note: (frame.note as string | null) ?? null,
      objects,
      drawings: (Array.isArray(frame.drawings) ? frame.drawings : []) as Drawing[],
    } satisfies Frame;
  });
  return {
    id: String(data.id),
    name: String(data.name ?? "Taktik"),
    pitch_type: (data.pitch_type as PitchType) ?? "full",
    frames,
  };
}
