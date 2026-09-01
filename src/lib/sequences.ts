import type { Drawing, Frame } from "./tactics";
import { uid } from "./tactics";

export type Point = { x: number; y: number };

/** Ny sekvens läggs alltid sist och utgår från sista sekvensens slutläge. */
export function appendSequence(frames: Frame[]): Frame[] {
  const source = frames[frames.length - 1];
  if (!source) return frames;
  return [
    ...frames,
    {
      id: uid(),
      name: null,
      objects: source.objects.map((object) => ({ ...object })),
      drawings: [],
    },
  ];
}

/** Avancerat: infoga en sekvens direkt efter angivet index. */
export function insertSequenceAfter(frames: Frame[], index: number): Frame[] {
  const source = frames[index];
  if (!source) return frames;
  const copy: Frame = {
    id: uid(),
    name: null,
    objects: source.objects.map((object) => ({ ...object })),
    drawings: [],
  };
  const next = [...frames];
  next.splice(index + 1, 0, copy);
  return next;
}

/** Flyttar ett objekt i den aktiva sekvensen. Skapar aldrig en sekvens. */
export function applyMove(
  frames: Frame[],
  index: number,
  objectId: string,
  point: Point,
): Frame[] {
  return frames.map((frame, i) =>
    i === index
      ? {
          ...frame,
          objects: frame.objects.map((object) =>
            object.id === objectId ? { ...object, x: point.x, y: point.y } : object,
          ),
        }
      : frame,
  );
}

/** En väg per objekt och övergång – befintlig väg uppdateras i stället för att dubbleras. */
export function upsertPath(drawings: Drawing[], next: Drawing): Drawing[] {
  return [
    ...drawings.filter(
      (drawing) =>
        !(
          (drawing.type === "run" || drawing.type === "pass") &&
          drawing.objectId === next.objectId
        ),
    ),
    next,
  ];
}

/**
 * Löpning/passning i den aktiva sekvensen: objektets slutposition sätts och vägen
 * kopplas till målsekvensen. Startläget (index 0) får aldrig ta emot en väg.
 */
export function applyTrail(
  frames: Frame[],
  index: number,
  objectId: string,
  kind: "run" | "pass",
  from: Point,
  to: Point,
): Frame[] {
  if (index <= 0) return frames;
  return frames.map((frame, i) =>
    i === index
      ? {
          ...frame,
          objects: frame.objects.map((object) =>
            object.id === objectId ? { ...object, x: to.x, y: to.y } : object,
          ),
          drawings: upsertPath(frame.drawings, {
            id: uid(),
            type: kind,
            color: null,
            objectId,
            x1: from.x,
            y1: from.y,
            x2: to.x,
            y2: to.y,
          }),
        }
      : frame,
  );
}
