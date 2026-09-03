import { describe, expect, it } from "vitest";
import {
  assignPlayerToSlot,
  defaultSlots,
  lineupStarters,
  moveSlotToBench,
  removePlayerFromLineup,
  sortPlayersByResponse,
  syncLineupWithSquad,
  validateMatchPlan,
  validateMeetBeforeStart,
} from "./match-plan";

const slots5 = defaultSlots("5v5");

describe("defaultSlots", () => {
  it("ger rätt antal positioner för varje spelform", () => {
    expect(defaultSlots("3v3")).toHaveLength(3);
    expect(defaultSlots("5v5")).toHaveLength(5);
    expect(defaultSlots("7v7")).toHaveLength(7);
    expect(defaultSlots("9v9")).toHaveLength(9);
    expect(defaultSlots("11v11")).toHaveLength(11);
  });

  it("har positioner innanför planen", () => {
    for (const s of defaultSlots("7v7")) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
  });
});

describe("assignPlayerToSlot", () => {
  it("placerar spelare och tar bort från bänken", () => {
    const { slots, bench } = assignPlayerToSlot(slots5, ["a", "b"], "a", 0);
    expect(slots[0]!.player_id).toBe("a");
    expect(bench).toEqual(["b"]);
  });

  it("samma spelare kan aldrig finnas på två positioner", () => {
    const s1 = assignPlayerToSlot(slots5, ["a"], "a", 0);
    const s2 = assignPlayerToSlot(s1.slots, s1.bench, "a", 2);
    expect(lineupStarters(s2.slots).filter((id) => id === "a")).toHaveLength(1);
    expect(s2.slots[0]!.player_id).toBeNull();
  });

  it("upptagen plats skickar tidigare spelare till bänken", () => {
    const s1 = assignPlayerToSlot(slots5, ["a", "b"], "a", 0);
    const s2 = assignPlayerToSlot(s1.slots, s1.bench, "b", 0);
    expect(s2.slots[0]!.player_id).toBe("b");
    expect(s2.bench).toContain("a");
  });
});

describe("moveSlotToBench / removePlayerFromLineup", () => {
  it("flyttar planspelare till bänken", () => {
    const s1 = assignPlayerToSlot(slots5, ["a"], "a", 0);
    const s2 = moveSlotToBench(s1.slots, s1.bench, 0);
    expect(s2.slots[0]!.player_id).toBeNull();
    expect(s2.bench).toContain("a");
  });

  it("rapporterar när en borttagen spelare låg på planen", () => {
    const s1 = assignPlayerToSlot(slots5, ["a"], "a", 0);
    const res = removePlayerFromLineup(s1.slots, s1.bench, "a");
    expect(res.wasOnPitch).toBe(true);
    expect(res.slots[0]!.player_id).toBeNull();
  });
});

describe("syncLineupWithSquad", () => {
  it("gör borttagen spelares plats till Tom plats och lägger nya på bänken", () => {
    const s1 = assignPlayerToSlot(slots5, ["a"], "a", 0);
    const res = syncLineupWithSquad(s1.slots, ["b", "c"]);
    expect(res.removedFromPitch).toEqual(["a"]);
    expect(res.slots[0]!.player_id).toBeNull();
    expect(res.bench.sort()).toEqual(["b", "c"]);
  });
});

describe("sortPlayersByResponse", () => {
  it("sorterar Kommer, Kanske, Ej svarat, Kan inte", () => {
    const players = [
      { id: "1", name: "Decl" },
      { id: "2", name: "Att" },
      { id: "3", name: "Pend" },
      { id: "4", name: "Maybe" },
    ];
    const map = new Map([
      ["1", "declined" as const],
      ["2", "attending" as const],
      ["4", "maybe" as const],
    ]);
    const sorted = sortPlayersByResponse(players, map).map((p) => p.id);
    expect(sorted).toEqual(["2", "4", "3", "1"]);
  });
});

describe("validateMatchPlan", () => {
  const base = {
    playerIds: ["a", "b", "c", "d", "e"],
    coachIds: ["coach"],
    slots: slots5.map((s, i) => ({ ...s, player_id: ["a", "b", "c", "d", "e"][i]! })),
    bench: [] as string[],
    required: 5,
  };

  it("godkänner en komplett 5 mot 5-plan", () => {
    expect(validateMatchPlan(base)).toBeNull();
  });

  it("kräver minst en ledare", () => {
    expect(validateMatchPlan({ ...base, coachIds: [] })).toContain("ledare");
  });

  it("kräver exakt rätt antal startspelare", () => {
    const slots = base.slots.map((s, i) => (i === 0 ? { ...s, player_id: null } : s));
    expect(validateMatchPlan({ ...base, slots })).toContain("exakt 5");
  });

  it("tillåter inte dubbletter", () => {
    const slots = base.slots.map((s) => ({ ...s, player_id: "a" }));
    expect(validateMatchPlan({ ...base, slots })).toContain("en planposition");
  });

  it("avbytare får inte ligga på planen samtidigt", () => {
    expect(validateMatchPlan({ ...base, bench: ["a"] })).toContain("avbytare");
  });

  it("alla på planen måste ingå i uttagningen", () => {
    expect(validateMatchPlan({ ...base, playerIds: ["a", "b"] })).toContain("uttagningen");
  });

  it("tillåter för få spelare när allowFewPlayers är satt", () => {
    const slots = base.slots.map((s, i) => (i < 2 ? { ...s, player_id: null } : s));
    expect(validateMatchPlan({ ...base, slots, allowFewPlayers: true })).toBeNull();
    expect(
      validateMatchPlan({ ...base, playerIds: [], slots: [], allowFewPlayers: true }),
    ).toBeNull();
  });

  it("blockerar fortfarande andra fel trots allowFewPlayers", () => {
    const slots = base.slots.map((s) => ({ ...s, player_id: "a" }));
    expect(validateMatchPlan({ ...base, slots, allowFewPlayers: true })).toContain(
      "en planposition",
    );
    expect(validateMatchPlan({ ...base, coachIds: [], allowFewPlayers: true })).toContain("ledare");
  });
});

describe("validateMeetBeforeStart", () => {
  const start = "2026-09-10T18:00:00.000Z";
  it("godkänner samling före matchstart", () => {
    expect(validateMeetBeforeStart("2026-09-10T17:30:00.000Z", start)).toBeNull();
  });
  it("avvisar samling efter matchstart", () => {
    expect(validateMeetBeforeStart("2026-09-10T18:15:00.000Z", start)).toContain("före");
  });
  it("tillåter tom samlingstid", () => {
    expect(validateMeetBeforeStart(null, start)).toBeNull();
  });
});
