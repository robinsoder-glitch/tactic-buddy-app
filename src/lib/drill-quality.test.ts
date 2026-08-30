import { describe, expect, it } from "vitest";
import { REQUIRED_DRILL_FIELDS, isDrillComplete, missingDrillFields } from "./drill-quality";
import type { Drill } from "./taktikbank";

const complete: Pick<Drill, "data"> = {
  data: {
    id: "d01",
    title: "Test",
    purpose: "Syfte",
    format: "5v5",
    ageFit: { min: 8, max: 9 },
    area: "20 x 25 m",
    players: "8 spelare",
    equipment: ["koner"],
    organisation: ["Ställ upp"],
    execution: ["Kör"],
    coachingPoints: ["Lyft blicken"],
    simplify: ["Större yta"],
    challenge: ["Färre touch"],
    defaultMinutes: 8,
  },
};

describe("drill-quality", () => {
  it("godkänner en övning som följer hela mallen", () => {
    expect(missingDrillFields(complete)).toEqual([]);
    expect(isDrillComplete(complete)).toBe(true);
  });

  it("listar alla fält som saknas i en tom övning", () => {
    const empty: Pick<Drill, "data"> = { data: { id: "x", title: "X" } };
    expect(missingDrillFields(empty)).toEqual([...REQUIRED_DRILL_FIELDS]);
    expect(isDrillComplete(empty)).toBe(false);
  });

  it("underkänner tomma listor, tom text och ogiltigt åldersspann", () => {
    const bad: Pick<Drill, "data"> = {
      data: { ...complete.data, purpose: "  ", equipment: [], ageFit: { min: 10, max: 8 }, defaultMinutes: 0 },
    };
    expect(missingDrillFields(bad).sort()).toEqual(["ageFit", "defaultMinutes", "equipment", "purpose"].sort());
  });
});
