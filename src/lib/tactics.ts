export type PitchType = "full" | "small" | "half" | "third";
export type Team = "home" | "away";

export type FieldObject = {
  id: string;
  kind: "player" | "ball" | "cone" | "goal";
  playerId?: string | null;
  label: string;
  number?: number | null;
  team: Team;
  /** goalkeepers get a separate jersey colour */
  gk?: boolean;
  photoUrl?: string | null;
  x: number; // 0..1
  y: number; // 0..1
};

export type DrawingType = "run" | "pass" | "zone" | "circle";

export type Drawing = {
  id: string;
  type: DrawingType;
  color?: string | null;
  /** Löp-/passvägar hör ihop med objektet de beskriver, så de kan uppdateras i stället för att dubbleras. */
  objectId?: string | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type Frame = {
  id: string;
  name: string | null;
  note?: string | null;
  objects: FieldObject[];
  drawings: Drawing[];
};

export type PlayerRow = {
  id: string;
  name: string;
  number: number | null;
  team: string;
  photo_path: string | null;
  is_goalkeeper?: boolean;
};

export type PlayerWithPhoto = PlayerRow & { photoUrl: string | null };

export const PITCH_SIZES: Record<PitchType, { w: number; h: number; label: string }> = {
  full: { w: 105, h: 68, label: "11-manna" },
  small: { w: 60, h: 40, label: "5/7-manna" },
  half: { w: 52.5, h: 68, label: "Halvplan" },
  third: { w: 35, h: 68, label: "Anfallszon" },
};

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Interpolate object positions between keyframes.
 * `progress` is expressed in frame units: 0 = first frame, 1 = second frame, ...
 */
export function interpolateFrames(frames: Frame[], progress: number): FieldObject[] {
  if (frames.length === 0) return [];
  if (frames.length === 1) return frames[0]!.objects;

  const maxIndex = frames.length - 1;
  const clamped = Math.min(Math.max(progress, 0), maxIndex);
  const from = Math.floor(clamped);
  const to = Math.min(from + 1, maxIndex);
  const t = easeInOut(clamped - from);

  const start = frames[from]!;
  const end = frames[to]!;
  const endById = new Map(end.objects.map((object) => [object.id, object]));

  return start.objects.map((object) => {
    const target = endById.get(object.id);
    if (!target) return object;
    return {
      ...object,
      x: object.x + (target.x - object.x) * t,
      y: object.y + (target.y - object.y) * t,
    };
  });
}

export function activeFrameIndex(progress: number, frameCount: number) {
  return Math.min(Math.max(Math.round(progress), 0), Math.max(frameCount - 1, 0));
}

/** Löp- och passvägar hör till målsekvensen: Sekvens N innehåller vägarna från N-1 in i N. */
export function isPathDrawing(drawing: Drawing) {
  return drawing.type === "run" || drawing.type === "pass";
}

/**
 * Vägarna som ska visas vid en viss tidpunkt i uppspelningen.
 * Under övergången från sekvens N till N+1 visas målsekvensens vägar.
 */
export function drawingsAtProgress(frames: Frame[], progress: number): Drawing[] {
  if (frames.length === 0) return [];
  if (frames.length === 1) return frames[0]!.drawings;
  const segment = Math.min(Math.floor(progress), frames.length - 2);
  const target = frames[Math.max(segment, 0) + 1]!;
  const source = frames[Math.max(segment, 0)]!;
  // Målsekvensens vägar plus källans statiska markeringar (zoner/cirklar).
  return [...source.drawings.filter((item) => !isPathDrawing(item)), ...target.drawings];
}

/**
 * Bakåtkompatibilitet: äldre taktiker sparade vägen i källsekvensen.
 * Flyttar sådana vägar till målsekvensen utan att röra övrig data.
 */
export function normalizeTransitionPaths(frames: Frame[]): Frame[] {
  if (frames.length < 2) return frames;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.03;
  const result = frames.map((frame) => ({ ...frame, drawings: [...frame.drawings] }));
  let changed = false;

  for (let index = 0; index < result.length - 1; index += 1) {
    const source = result[index]!;
    const target = result[index + 1]!;
    const keep: Drawing[] = [];
    for (const drawing of source.drawings) {
      if (!isPathDrawing(drawing)) {
        keep.push(drawing);
        continue;
      }
      const owner = source.objects.find(
        (object) => near(object.x, drawing.x1) && near(object.y, drawing.y1),
      );
      const ends = owner
        ? target.objects.find(
            (object) =>
              object.id === owner.id && near(object.x, drawing.x2) && near(object.y, drawing.y2),
          )
        : undefined;
      if (owner && ends) {
        target.drawings.push({ ...drawing, objectId: owner.id });
        changed = true;
      } else {
        keep.push(drawing);
      }
    }
    source.drawings = keep;
  }

  return changed ? result : frames;
}

/** Minsta förflyttning (0..1) som räknas som en rörelse och ger en pil. */
export const MOVE_EPS = 0.015;

/**
 * Härleder rörelsepilar (löpvägar/passningar) ur två intilliggande bilder.
 * Pilarna lagras aldrig – de räknas alltid om, så gamla pilar kan inte bli kvar.
 */
export function movementDrawings(frames: Frame[], index: number): Drawing[] {
  const current = frames[index];
  const previous = frames[index - 1];
  if (!current || !previous) return [];
  const prevById = new Map(previous.objects.map((object) => [object.id, object]));

  return current.objects.flatMap((object) => {
    const from = prevById.get(object.id);
    if (!from) return [];
    const dx = object.x - from.x;
    const dy = object.y - from.y;
    if (Math.hypot(dx, dy) < MOVE_EPS) return [];
    return [
      {
        id: `move-${current.id}-${object.id}`,
        type: object.kind === "ball" ? ("pass" as const) : ("run" as const),
        objectId: object.id,
        x1: from.x,
        y1: from.y,
        x2: object.x,
        y2: object.y,
      },
    ];
  });
}

/** Statiska markeringar (zoner/cirklar) – dessa sparas som vanligt. */
export function staticDrawings(frame: Frame | undefined): Drawing[] {
  return (frame?.drawings ?? []).filter((drawing) => !isPathDrawing(drawing));
}

/** Pilar och markeringar som ska visas vid en viss tidpunkt under uppspelning. */
export function displayDrawingsAt(
  frames: Frame[],
  progress: number,
  animating: boolean,
  index: number,
): Drawing[] {
  if (!animating) return [...staticDrawings(frames[index]), ...movementDrawings(frames, index)];
  const segment = Math.min(Math.max(Math.floor(progress), 0), Math.max(frames.length - 2, 0));
  const target = segment + 1;
  return [...staticDrawings(frames[segment]), ...movementDrawings(frames, target)];
}
