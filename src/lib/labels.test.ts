import { describe, expect, it } from "vitest";
import {
  GAME_MOMENT_LABELS,
  PHASE_LABELS,
  ROLE_LABELS,
  cardToFrames,
  label,
  type TacticCardData,
} from "./taktikbank";

/** Värden som faktiskt finns i bankens data (databasvärdena ändras aldrig). */
const MOMENTS = ["restart", "ball_win", "own_possession", "ball_loss", "opponent_possession"];
const PHASES = [
  "touchline_restart",
  "build_up",
  "defend_goal",
  "progress",
  "create_chance",
  "defensive_transition",
  "corner",
  "offensive_transition",
  "numerical_advantage",
  "goalkeeper_restart",
];

const ENGLISH = [
  "restart",
  "offensive transition",
  "defensive transition",
  "goalkeeper restart",
  "touchline restart",
  "corner",
  "Extras spelare",
  "Framåtskjutande",
  "coachfråga",
];

describe("svenska etiketter i Taktikbank och Övningsbank", () => {
  it("översätter alla spelmoment och faser som finns i banken", () => {
    for (const key of MOMENTS) expect(label(GAME_MOMENT_LABELS, key)).not.toContain("_");
    for (const key of PHASES) expect(label(PHASE_LABELS, key)).not.toContain("_");
  });

  it("visar inga engelska uttryck", () => {
    const visible = [...MOMENTS, ...PHASES]
      .map((key) => label(PHASE_LABELS, key))
      .concat(Object.values(GAME_MOMENT_LABELS), Object.values(PHASE_LABELS), Object.values(ROLE_LABELS))
      .join(" | ")
      .toLowerCase();
    for (const phrase of ENGLISH) expect(visible).not.toContain(phrase.toLowerCase());
  });

  it("använder de begärda svenska begreppen", () => {
    expect(label(PHASE_LABELS, "offensive_transition")).toBe("Offensiv omställning");
    expect(label(PHASE_LABELS, "defensive_transition")).toBe("Defensiv omställning");
    expect(label(PHASE_LABELS, "goalkeeper_restart")).toBe("Målvaktsstart");
    expect(label(PHASE_LABELS, "touchline_restart")).toBe("Igångsättning från sidlinjen");
    expect(label(PHASE_LABELS, "corner")).toBe("Hörna");
    expect(label(GAME_MOMENT_LABELS, "restart")).toBe("Igångsättning");
    expect(label(PHASE_LABELS, "progress")).toBe("Spela framåt");
    expect(label(ROLE_LABELS, "extra_player")).toBe("Extraspelare");
  });

  it("faller aldrig tillbaka på engelsk text med understreck", () => {
    expect(label(GAME_MOMENT_LABELS, "touchline_restart")).toBe("Igångsättning från sidlinjen");
    expect(label(ROLE_LABELS, "goalkeeper_restart")).toBe("Målvaktsstart");
  });
});

describe("animationerna påverkas inte av översättningen", () => {
  const card: TacticCardData = {
    id: "t1",
    title: "Test",
    format: "5v5",
    difficulty: 1,
    gameMoment: "restart",
    phase: "offensive_transition",
    purpose: "Test",
    actors: [{ id: "a1", team: "home", roleId: "extra_player", x: 0, y: 0 }],
    keyframes: [
      {
        id: "k1",
        kind: "start",
        durationMs: 1000,
        actorPositions: [{ actorId: "a1", x: 0, y: 0 }],
        ball: { x: 0, y: 0 },
      },
      {
        id: "k2",
        kind: "movement",
        durationMs: 1000,
        actorPositions: [{ actorId: "a1", x: 5000, y: 5000 }],
        ball: { x: 5000, y: 5000 },
        arrows: [{ kind: "run", from: { x: 0, y: 0 }, to: { x: 5000, y: 5000 } }],
      },
    ],
  };

  it("bygger frames med rörelse mellan stegen", () => {
    const frames = cardToFrames(card);
    expect(frames).toHaveLength(2);
    const first = frames[0]!.objects.find((object) => object.id === "a1");
    const second = frames[1]!.objects.find((object) => object.id === "a1");
    expect(first?.x).toBe(0);
    expect(second?.x).toBeCloseTo(0.5);
    expect(second?.label).toBe("Extraspelare");
  });
});
