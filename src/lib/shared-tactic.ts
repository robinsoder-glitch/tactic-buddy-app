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

const get = (raw: Loose, key: string): unknown => raw[key];

function publicObject(raw: Loose, fallbackLabel: string): FieldObject {
  const kind = (get(raw, "kind") as FieldObject["kind"]) ?? "player";
  const rawNumber = get(raw, "number");
  const label = get(raw, "label");
  return {
    id: String(get(raw, "id") ?? ""),
    kind,
    label: kind === "player" ? String(label ?? fallbackLabel) : String(label ?? ""),
    number: typeof rawNumber === "number" ? rawNumber : null,
    team: (get(raw, "team") as FieldObject["team"]) ?? "home",
    ...(get(raw, "gk") === true ? { gk: true } : {}),
    x: Number(get(raw, "x") ?? 0),
    y: Number(get(raw, "y") ?? 0),
  };
}

/** Tolkar svaret från den säkra databasfunktionen. Kastar om taktiken inte delas. */
export function parseSharedTactic(payload: unknown): SharedTactic {
  const data = payload as Loose | null;
  if (!data || typeof data !== "object" || !get(data, "id")) {
    throw new Error("Taktiken är inte delad eller finns inte.");
  }
  const labels = new Map<string, string>();
  const rawFrames = get(data, "frames");
  const frames = (Array.isArray(rawFrames) ? rawFrames : []).map((frameRaw) => {
    const frame = frameRaw as Loose;
    const rawObjects = get(frame, "objects");
    const objects = (Array.isArray(rawObjects) ? rawObjects : []).map((objectRaw) => {
      const raw = objectRaw as Loose;
      const id = String(get(raw, "id") ?? "");
      if ((get(raw, "kind") ?? "player") === "player" && !labels.has(id)) {
        labels.set(id, `Spelare ${labels.size + 1}`);
      }
      return publicObject(raw, labels.get(id) ?? "Spelare");
    });
    const rawDrawings = get(frame, "drawings");
    return {
      id: String(get(frame, "id") ?? ""),
      name: (get(frame, "name") as string | null) ?? null,
      note: (get(frame, "note") as string | null) ?? null,
      objects,
      drawings: (Array.isArray(rawDrawings) ? rawDrawings : []) as Drawing[],
    } satisfies Frame;
  });
  return {
    id: String(get(data, "id")),
    name: String(get(data, "name") ?? "Taktik"),
    pitch_type: (get(data, "pitch_type") as PitchType) ?? "full",
    frames,
  };
}
