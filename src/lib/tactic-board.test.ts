import { describe, expect, it } from "vitest";
import {
  buildLineup,
  EMPTY_SLOT_LABEL,
  FORMATIONS,
  formationsForPitch,
  mirrorSlots,
  pitchForFormation,
} from "./formations";
import { appendSequence, applyMove, applyTrail } from "./sequences";
import { buildTacticFile, parseTacticFile } from "./tactic-file";
import {
  clamp01,
  displayDrawingsAt,
  interpolateFrames,
  movementDrawings,
  PITCH_SIZES,
  uid,
} from "./tactics";
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

/** Skärmbredder som taktiktavlan ska fungera på. */
const WIDTHS = [375, 768, 1440];

describe("Objekt-id och koordinater", () => {
  it("varje objekt får ett unikt id", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 500; i += 1) ids.add(uid());
    expect(ids.size).toBe(500);
  });

  it("koordinater hålls normaliserade mellan 0 och 1", () => {
    expect(clamp01(-0.4)).toBe(0);
    expect(clamp01(1.8)).toBe(1);
    expect(clamp01(0.42)).toBe(0.42);
  });

  it("normaliserade koordinater ger samma relativa läge på 375, 768 och 1440 px", () => {
    const object = player("A", 0.25, 0.75);
    const { w, h } = PITCH_SIZES.full;
    for (const width of WIDTHS) {
      const height = (width * h) / w;
      expect(object.x * width).toBeCloseTo(width * 0.25, 6);
      expect(object.y * height).toBeCloseTo(height * 0.75, 6);
    }
  });
});

describe("Formationer 3v3–11v11", () => {
  const sizes = [3, 5, 7, 9, 11];

  it("varje spelform har minst en formation", () => {
    for (const size of sizes) {
      expect(FORMATIONS.some((formation) => formation.players === size)).toBe(true);
    }
  });

  it("alla platser ligger innanför planen, även speglade", () => {
    for (const formation of FORMATIONS) {
      expect(formation.slots).toHaveLength(formation.players);
      for (const slot of [...formation.slots, ...mirrorSlots(formation.slots)]) {
        expect(slot.x).toBeGreaterThan(0);
        expect(slot.x).toBeLessThan(1);
        expect(slot.y).toBeGreaterThan(0);
        expect(slot.y).toBeLessThan(1);
      }
    }
  });

  it("varje verklig spelare används högst en gång och tomma platser märks ut", () => {
    const bank = [
      { id: "gk", name: "Målis", gk: true },
      { id: "p1", name: "Alva" },
      { id: "p2", name: "Bea" },
    ];
    for (const formation of FORMATIONS) {
      const lineup = buildLineup(formation.slots, bank);
      const used = lineup.map((entry) => entry.playerId).filter(Boolean) as string[];
      expect(new Set(used).size).toBe(used.length);
      const empty = lineup.filter((entry) => entry.playerId === null);
      for (const entry of empty) expect(entry.label).toBe(EMPTY_SLOT_LABEL);
      expect(used.length + empty.length).toBe(formation.players);
    }
  });

  it("planlayout och sortering följer spelformen", () => {
    expect(pitchForFormation(3)).toBe("small");
    expect(pitchForFormation(11)).toBe("full");
    expect(formationsForPitch("full")[0]!.players).toBe(11);
  });
});

describe("Sekvenser: kopiering, borttagning och uppspelningsordning", () => {
  it("ny sekvens kopierar positionerna utan att ändra föregående", () => {
    const a = player("A", 0.2, 0.2);
    let frames = board([a]);
    frames = appendSequence(frames);
    frames = applyMove(frames, 1, a.id, { x: 0.8, y: 0.4 });
    expect(frames[0]!.objects[0]!.x).toBe(0.2);
    expect(frames[1]!.objects[0]!.x).toBe(0.8);
    expect(frames[0]!.id).not.toBe(frames[1]!.id);
  });

  it("borttagen sekvens tar med sina vägar och lämnar övriga orörda", () => {
    const a = player("A", 0.2, 0.2);
    let frames = appendSequence(appendSequence(board([a])));
    frames = applyTrail(frames, 1, a.id, "run", { x: 0.2, y: 0.2 }, { x: 0.5, y: 0.2 });
    frames = applyTrail(frames, 2, a.id, "run", { x: 0.5, y: 0.2 }, { x: 0.8, y: 0.2 });
    const kept = frames.filter((_, index) => index !== 1);
    expect(kept).toHaveLength(2);
    expect(kept.flatMap((frame) => frame.drawings).every((d) => d.objectId === a.id)).toBe(true);
    expect(kept[0]!.objects[0]!.x).toBe(0.2);
  });

  it("uppspelningen är deterministisk och följer sekvensordningen", () => {
    const a = player("A", 0.1, 0.5);
    let frames = board([a]);
    for (let step = 1; step <= 3; step += 1) {
      frames = appendSequence(frames);
      frames = applyMove(frames, step, a.id, { x: 0.1 + step * 0.2, y: 0.5 });
    }
    const run = () => [0, 0.5, 1, 1.5, 2, 3].map((t) => interpolateFrames(frames, t)[0]!.x);
    expect(run()).toEqual(run());
    const values = run();
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]!).toBeGreaterThanOrEqual(values[i - 1]!);
    }
    // Uppspelningen skriver aldrig över sparade positioner.
    expect(frames[0]!.objects[0]!.x).toBe(0.1);
    expect(frames[3]!.objects[0]!.x).toBeCloseTo(0.7, 6);
  });
});

describe("Pilar hör till rätt sekvens", () => {
  it("en pil från en tidigare sekvens visas inte i en senare", () => {
    const a = player("A", 0.2, 0.2);
    const b = player("B", 0.2, 0.8);
    let frames = appendSequence(board([a, b]));
    frames = applyMove(frames, 1, a.id, { x: 0.7, y: 0.2 });
    frames = appendSequence(frames);
    frames = applyMove(frames, 2, b.id, { x: 0.7, y: 0.8 });

    const inSeq1 = movementDrawings(frames, 1).map((d) => d.objectId);
    const inSeq2 = movementDrawings(frames, 2).map((d) => d.objectId);
    expect(inSeq1).toEqual([a.id]);
    expect(inSeq2).toEqual([b.id]);
    expect(displayDrawingsAt(frames, 2, false, 2).map((d) => d.objectId)).toEqual([b.id]);
  });

  it("bollens väg blir passning och spelarens väg blir löpväg", () => {
    const a = player("A", 0.2, 0.5);
    const boll = ball(0.24, 0.5);
    let frames = appendSequence(board([a, boll]));
    frames = applyMove(frames, 1, a.id, { x: 0.5, y: 0.5 });
    frames = applyMove(frames, 1, boll.id, { x: 0.8, y: 0.5 });
    const types = new Map(movementDrawings(frames, 1).map((d) => [d.objectId, d.type]));
    expect(types.get(a.id)).toBe("run");
    expect(types.get(boll.id)).toBe("pass");
  });
});

describe("Spara och ladda", () => {
  it("samma taktik återställs efter export och import", () => {
    const a = player("A", 0.2, 0.2);
    const boll = ball(0.24, 0.24);
    let frames = appendSequence(board([a, boll]));
    frames = applyMove(frames, 1, a.id, { x: 0.7, y: 0.3 });
    frames = applyMove(frames, 1, boll.id, { x: 0.74, y: 0.34 });
    frames = frames.map((frame, index) => ({ ...frame, name: `Steg ${index + 1}`, note: null }));

    const file = buildTacticFile("Överlapp höger", "full", frames);
    const parsed = parseTacticFile(JSON.stringify(file));
    expect(parsed.name).toBe("Överlapp höger");
    expect(parsed.pitchType).toBe("full");
    expect(parsed.frames).toEqual(frames);
    expect(interpolateFrames(parsed.frames, 1)).toEqual(interpolateFrames(frames, 1));
  });
});

describe("Scenario 1: A och B framåt, C och D byter plats, A driver och passar", () => {
  it("objekten följer rätt vägar och inga gamla pilar följer med", () => {
    const a = player("A", 0.2, 0.3);
    const b = player("B", 0.2, 0.7);
    const c = player("C", 0.35, 0.2);
    const d = player("D", 0.35, 0.8);
    const boll = ball(0.24, 0.3);
    let frames = board([a, b, c, d, boll]);

    // Sekvens 1: A och B till andra planhalvan, C och D byter plats, A driver bollen.
    frames = appendSequence(frames);
    frames = applyMove(frames, 1, a.id, { x: 0.65, y: 0.3 });
    frames = applyMove(frames, 1, boll.id, { x: 0.69, y: 0.3 });
    frames = applyMove(frames, 1, b.id, { x: 0.65, y: 0.7 });
    frames = applyMove(frames, 1, c.id, { x: 0.35, y: 0.8 });
    frames = applyMove(frames, 1, d.id, { x: 0.35, y: 0.2 });

    // Sekvens 2: A passar till B.
    frames = appendSequence(frames);
    frames = applyMove(frames, 2, boll.id, { x: 0.65, y: 0.7 });

    expect(frames).toHaveLength(3);
    // A och B är på andra planhalvan.
    expect(frames[1]!.objects.find((o) => o.id === a.id)!.x).toBeGreaterThan(0.5);
    expect(frames[1]!.objects.find((o) => o.id === b.id)!.x).toBeGreaterThan(0.5);
    // C och D har bytt plats.
    expect(frames[1]!.objects.find((o) => o.id === c.id)!.y).toBeCloseTo(0.8, 6);
    expect(frames[1]!.objects.find((o) => o.id === d.id)!.y).toBeCloseTo(0.2, 6);
    // Drivning: bollen följer A i sekvens 1.
    const seq1 = movementDrawings(frames, 1);
    expect(seq1.map((drawing) => drawing.objectId).sort()).toEqual(
      [a.id, b.id, c.id, d.id, boll.id].sort(),
    );
    // Passning: endast bollen rör sig i sekvens 2.
    const seq2 = movementDrawings(frames, 2);
    expect(seq2).toHaveLength(1);
    expect(seq2[0]!.objectId).toBe(boll.id);
    expect(seq2[0]!.type).toBe("pass");
    // Bollen teleporterar inte: den startar där den slutade i sekvens 1.
    expect(seq2[0]!.x1).toBeCloseTo(0.69, 6);
    // Inga pilar från sekvens 1 syns i sekvens 2.
    const shown = displayDrawingsAt(frames, 2, false, 2).map((drawing) => drawing.objectId);
    expect(shown).toEqual([boll.id]);
    // Alla koordinater ligger innanför planen.
    for (const frame of frames) {
      for (const object of frame.objects) {
        expect(object.x).toBeGreaterThanOrEqual(0);
        expect(object.x).toBeLessThanOrEqual(1);
        expect(object.y).toBeGreaterThanOrEqual(0);
        expect(object.y).toBeLessThanOrEqual(1);
      }
    }
  });
});
