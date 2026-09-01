import { describe, expect, it } from "vitest";
import { FORMATIONS, formationsForPitch, mirrorSlots } from "./formations";

describe("formationer", () => {
  it("har lika många positioner som spelare och exakt en målvakt", () => {
    for (const formation of FORMATIONS) {
      expect(formation.slots).toHaveLength(formation.players);
      expect(formation.slots.filter((slot) => slot.gk)).toHaveLength(1);
      for (const slot of formation.slots) {
        expect(slot.x).toBeGreaterThan(0);
        expect(slot.x).toBeLessThan(1);
        expect(slot.y).toBeGreaterThan(0);
        expect(slot.y).toBeLessThan(1);
      }
    }
  });

  it("föreslår 5 mot 5 först på liten plan och 11 mot 11 på fullstor", () => {
    expect(formationsForPitch("small")[0]!.players).toBe(5);
    expect(formationsForPitch("full")[0]!.players).toBe(11);
  });

  it("speglar positionerna", () => {
    expect(mirrorSlots([{ x: 0.2, y: 0.4 }])[0]).toEqual({ x: 0.8, y: 0.4 });
  });
});
