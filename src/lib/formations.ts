import type { PitchType } from "./tactics";

export type FormationSlot = { x: number; y: number; gk?: boolean };

export type Formation = {
  id: string;
  label: string;
  /** Antal utespelare + målvakt */
  players: number;
  slots: FormationSlot[];
};

/**
 * Koordinaterna är normaliserade (0..1) med eget lag som spelar mot höger.
 * x = längdriktning, y = bredd.
 */
export const FORMATIONS: Formation[] = [
  {
    id: "5v5-1-2-1",
    label: "5 mot 5 – 1-2-1",
    players: 5,
    slots: [
      { x: 0.07, y: 0.5, gk: true },
      { x: 0.28, y: 0.5 },
      { x: 0.52, y: 0.25 },
      { x: 0.52, y: 0.75 },
      { x: 0.75, y: 0.5 },
    ],
  },
  {
    id: "5v5-2-2",
    label: "5 mot 5 – 2-2",
    players: 5,
    slots: [
      { x: 0.07, y: 0.5, gk: true },
      { x: 0.3, y: 0.3 },
      { x: 0.3, y: 0.7 },
      { x: 0.68, y: 0.3 },
      { x: 0.68, y: 0.7 },
    ],
  },
  {
    id: "7v7-2-3-1",
    label: "7 mot 7 – 2-3-1",
    players: 7,
    slots: [
      { x: 0.07, y: 0.5, gk: true },
      { x: 0.26, y: 0.3 },
      { x: 0.26, y: 0.7 },
      { x: 0.5, y: 0.2 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.8 },
      { x: 0.76, y: 0.5 },
    ],
  },
  {
    id: "7v7-3-2-1",
    label: "7 mot 7 – 3-2-1",
    players: 7,
    slots: [
      { x: 0.07, y: 0.5, gk: true },
      { x: 0.24, y: 0.22 },
      { x: 0.24, y: 0.5 },
      { x: 0.24, y: 0.78 },
      { x: 0.5, y: 0.35 },
      { x: 0.5, y: 0.65 },
      { x: 0.76, y: 0.5 },
    ],
  },
  {
    id: "9v9-3-3-2",
    label: "9 mot 9 – 3-3-2",
    players: 9,
    slots: [
      { x: 0.07, y: 0.5, gk: true },
      { x: 0.24, y: 0.2 },
      { x: 0.24, y: 0.5 },
      { x: 0.24, y: 0.8 },
      { x: 0.48, y: 0.2 },
      { x: 0.48, y: 0.5 },
      { x: 0.48, y: 0.8 },
      { x: 0.74, y: 0.35 },
      { x: 0.74, y: 0.65 },
    ],
  },
  {
    id: "11v11-4-4-2",
    label: "11 mot 11 – 4-4-2",
    players: 11,
    slots: [
      { x: 0.06, y: 0.5, gk: true },
      { x: 0.22, y: 0.16 },
      { x: 0.2, y: 0.38 },
      { x: 0.2, y: 0.62 },
      { x: 0.22, y: 0.84 },
      { x: 0.47, y: 0.16 },
      { x: 0.45, y: 0.38 },
      { x: 0.45, y: 0.62 },
      { x: 0.47, y: 0.84 },
      { x: 0.72, y: 0.38 },
      { x: 0.72, y: 0.62 },
    ],
  },
  {
    id: "11v11-4-3-3",
    label: "11 mot 11 – 4-3-3",
    players: 11,
    slots: [
      { x: 0.06, y: 0.5, gk: true },
      { x: 0.22, y: 0.16 },
      { x: 0.2, y: 0.38 },
      { x: 0.2, y: 0.62 },
      { x: 0.22, y: 0.84 },
      { x: 0.44, y: 0.3 },
      { x: 0.42, y: 0.5 },
      { x: 0.44, y: 0.7 },
      { x: 0.72, y: 0.18 },
      { x: 0.74, y: 0.5 },
      { x: 0.72, y: 0.82 },
    ],
  },
];

/** Formationer som passar den valda planlayouten bäst hamnar först. */
export function formationsForPitch(pitchType: PitchType): Formation[] {
  const preferred =
    pitchType === "full" ? 11 : pitchType === "small" ? 5 : pitchType === "half" ? 9 : 7;
  return [...FORMATIONS].sort(
    (a, b) => Math.abs(a.players - preferred) - Math.abs(b.players - preferred),
  );
}

/** Speglar en formation så att laget i stället anfaller åt vänster (motståndarlaget). */
export function mirrorSlots(slots: FormationSlot[]): FormationSlot[] {
  return slots.map((slot) => ({ ...slot, x: 1 - slot.x }));
}

/** Planlayout som hör ihop med formationens spelarantal. 9-manna spelas på 11-mannaplan. */
export function pitchForFormation(players: number): PitchType {
  if (players >= 9) return "full";
  return "small";
}
