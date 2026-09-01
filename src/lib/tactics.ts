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
