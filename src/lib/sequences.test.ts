import { describe, expect, it } from "vitest";
import { appendSequence, applyMove, applyTrail, insertSequenceAfter } from "./sequences";
import { drawingsAtProgress, interpolateFrames, normalizeTransitionPaths, uid } from "./tactics";
import type { FieldObject, Frame } from "./tactics";

function player(label: string, x: number, y: number, team: "home" | "away" = "home"): FieldObject {
  return { id: uid(), kind: "player", label, team, x, y };
}

function ball(x: number, y: number): FieldObject {
  return { id: uid(), kind: "ball", label: "Boll", team: "home", x, y };
}

function board(objects: FieldObject[]): Frame[] {
  return [{ id: uid(), name: null, objects, drawings: [] }];
}

describe("Sekvenser – endast uttryckliga kommandon skapar en sekvens", () => {
  it("Test 1: fyra spelare och boll rör sig i samma sekvens", () => {
    const p1 = player("1", 0.2, 0.2);
    const p2 = player("2", 0.3, 0.5);
    const p3 = player("3", 0.4, 0.8);
    const p4 = player("4", 0.6, 0.3);
    const b = ball(0.2, 0.22);
    let frames = board([p1, p2, p3, p4, b]);

    frames = appendSequence(frames);
    expect(frames).toHaveLength(2);

    frames = applyTrail(frames, 1, p1.id, "run", { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 });
    frames = applyTrail(frames, 1, b.id, "pass", { x: 0.2, y: 0.22 }, { x: 0.8, y: 0.22 });
    frames = applyMove(frames, 1, p2.id, { x: 0.75, y: 0.5 });
    frames = applyMove(frames, 1, p3.id, { x: 0.6, y: 0.3 });
    frames = applyMove(frames, 1, p4.id, { x: 0.4, y: 0.8 });

    expect(frames).toHaveLength(1 + 1);

    const mid = interpolateFrames(frames, 0.5);
    const byId = new Map(mid.map((object) => [object.id, object]));
    for (const id of [p1.id, p2.id, p3.id, p4.id, b.id]) {
      const start = frames[0]!.objects.find((object) => object.id === id)!;
      const end = frames[1]!.objects.find((object) => object.id === id)!;
      const now = byId.get(id)!;
      expect(now.x).toBeGreaterThan(Math.min(start.x, end.x) - 0.001);
      expect(now.x).toBeLessThan(Math.max(start.x, end.x) + 0.001);
      expect(now.x === start.x && now.y === start.y).toBe(false);
    }

    frames = appendSequence(frames);
    frames = applyTrail(frames, 2, b.id, "pass", { x: 0.8, y: 0.22 }, { x: 0.5, y: 0.6 });
    expect(frames).toHaveLength(3);
  });

  it("Test 2: egna spelare, motståndare och boll flyttas i samma sekvens", () => {
    const h1 = player("H1", 0.2, 0.2);
    const h2 = player("H2", 0.2, 0.6);
    const a1 = player("A1", 0.7, 0.2, "away");
    const a2 = player("A2", 0.7, 0.6, "away");
    const b = ball(0.5, 0.5);
    let frames = appendSequence(board([h1, h2, a1, a2, b]));
    for (const [object, point] of [
      [h1, { x: 0.4, y: 0.25 }],
      [h2, { x: 0.4, y: 0.65 }],
      [a1, { x: 0.6, y: 0.3 }],
      [a2, { x: 0.6, y: 0.5 }],
      [b, { x: 0.45, y: 0.45 }],
    ] as const) {
      frames = applyMove(frames, 1, object.id, point);
    }
    expect(frames).toHaveLength(2);
    expect(interpolateFrames(frames, 1)).toHaveLength(5);
  });

  it("Test 3: korsande löpvägar behåller objektens id och etikett", () => {
    const a = player("7", 0.3, 0.3);
    const b2 = player("9", 0.7, 0.7);
    let frames = appendSequence(board([a, b2]));
    frames = applyTrail(frames, 1, a.id, "run", { x: 0.3, y: 0.3 }, { x: 0.7, y: 0.7 });
    frames = applyTrail(frames, 1, b2.id, "run", { x: 0.7, y: 0.7 }, { x: 0.3, y: 0.3 });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const objects = interpolateFrames(frames, t);
      expect(objects.map((object) => object.id)).toEqual([a.id, b2.id]);
      expect(objects.map((object) => object.label)).toEqual(["7", "9"]);
    }
  });

  it("Test 4: objekt utan rörelse står exakt stilla", () => {
    const mover = player("1", 0.2, 0.2);
    const still = player("2", 0.5, 0.5);
    const b = ball(0.25, 0.25);
    let frames = appendSequence(board([mover, still, b]));
    frames = applyTrail(frames, 1, mover.id, "run", { x: 0.2, y: 0.2 }, { x: 0.7, y: 0.2 });
    frames = applyTrail(frames, 1, b.id, "pass", { x: 0.25, y: 0.25 }, { x: 0.7, y: 0.25 });
    for (const t of [0, 0.3, 0.6, 1]) {
      const now = interpolateFrames(frames, t).find((object) => object.id === still.id)!;
      expect(now.x).toBe(0.5);
      expect(now.y).toBe(0.5);
    }
  });

  it("Test 5: fem sekvenser med dribbling och passningar överlever spara/öppna", () => {
    const p = player("10", 0.2, 0.5);
    const b = ball(0.22, 0.5);
    let frames = board([p, b]);
    for (let step = 1; step <= 5; step += 1) {
      frames = appendSequence(frames);
      const x = 0.2 + step * 0.12;
      frames = applyTrail(frames, step, p.id, "run", { x: x - 0.12, y: 0.5 }, { x, y: 0.5 });
      frames = applyTrail(frames, step, b.id, "pass", { x: x - 0.1, y: 0.5 }, { x: x + 0.02, y: 0.5 });
    }
    expect(frames).toHaveLength(6);
    const roundTrip: Frame[] = JSON.parse(JSON.stringify(frames));
    expect(normalizeTransitionPaths(roundTrip)).toEqual(roundTrip);
    expect(interpolateFrames(roundTrip, 5).find((o) => o.id === p.id)!.x).toBeCloseTo(0.8, 5);
  });

  it("Flytta, Löpning och Passning ändrar aldrig antalet sekvenser", () => {
    const p = player("1", 0.2, 0.2);
    const b = ball(0.3, 0.3);
    let frames = appendSequence(board([p, b]));
    const before = frames.length;
    frames = applyMove(frames, 1, p.id, { x: 0.4, y: 0.2 });
    frames = applyTrail(frames, 1, p.id, "run", { x: 0.4, y: 0.2 }, { x: 0.6, y: 0.2 });
    frames = applyTrail(frames, 1, b.id, "pass", { x: 0.3, y: 0.3 }, { x: 0.6, y: 0.3 });
    frames = applyTrail(frames, 1, p.id, "run", { x: 0.6, y: 0.2 }, { x: 0.8, y: 0.2 });
    expect(frames.length).toBe(before);
    // Endast en väg per objekt och sekvens.
    expect(frames[1]!.drawings.filter((d) => d.objectId === p.id)).toHaveLength(1);
  });

  it("Startläget tar aldrig emot en väg", () => {
    const p = player("1", 0.2, 0.2);
    const frames = board([p]);
    const after = applyTrail(frames, 0, p.id, "run", { x: 0.2, y: 0.2 }, { x: 0.6, y: 0.6 });
    expect(after).toBe(frames);
    expect(after[0]!.drawings).toHaveLength(0);
  });

  it("Ny sekvens läggs alltid sist även när ett tidigare kort är markerat", () => {
    const p = player("1", 0.2, 0.2);
    let frames = appendSequence(appendSequence(board([p])));
    const firstId = frames[1]!.id;
    frames = appendSequence(frames); // aktivt kort spelar ingen roll
    expect(frames).toHaveLength(4);
    expect(frames[1]!.id).toBe(firstId);
    // Infogning finns kvar som separat funktion.
    const inserted = insertSequenceAfter(frames, 1);
    expect(inserted).toHaveLength(5);
    expect(inserted[1]!.id).toBe(firstId);
  });
});

describe("Vägar tillhör målsekvensen", () => {
  it("Sekvens N visar vägarna från N-1 in i N", () => {
    const p = player("1", 0.2, 0.2);
    let frames = appendSequence(board([p]));
    frames = applyTrail(frames, 1, p.id, "run", { x: 0.2, y: 0.2 }, { x: 0.6, y: 0.2 });
    frames = appendSequence(frames);
    frames = applyTrail(frames, 2, p.id, "run", { x: 0.6, y: 0.2 }, { x: 0.6, y: 0.8 });

    expect(drawingsAtProgress(frames, 0.5).map((d) => d.x2)).toEqual([0.6]);
    expect(drawingsAtProgress(frames, 1.5).map((d) => d.y2)).toEqual([0.8]);
  });

  it("Äldre taktiker med vägen i källsekvensen normaliseras", () => {
    const p = player("1", 0.2, 0.2);
    const legacy: Frame[] = [
      {
        id: uid(),
        name: null,
        objects: [{ ...p }],
        drawings: [{ id: uid(), type: "run", x1: 0.2, y1: 0.2, x2: 0.7, y2: 0.2 }],
      },
      { id: uid(), name: null, objects: [{ ...p, x: 0.7, y: 0.2 }], drawings: [] },
    ];
    const fixed = normalizeTransitionPaths(legacy);
    expect(fixed[0]!.drawings).toHaveLength(0);
    expect(fixed[1]!.drawings).toHaveLength(1);
    expect(fixed[1]!.drawings[0]!.objectId).toBe(p.id);
  });
});
