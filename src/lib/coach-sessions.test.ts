import { describe, expect, it } from "vitest";
import { copyTitle, moveItem, templateItems, totalMinutes } from "./coach-sessions";
import type { TrainingSessionCard } from "./taktikbank";

const items = [
  { id: "a", sort_order: 0, minutes: 10 },
  { id: "b", sort_order: 1, minutes: 20 },
  { id: "c", sort_order: 2, minutes: 15 },
];

describe("coach-sessions", () => {
  it("summerar total träningstid", () => {
    expect(totalMinutes(items)).toBe(45);
  });

  it("flyttar en del uppåt och numrerar om ordningen", () => {
    const next = moveItem(items, 2, -1);
    expect(next.map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(next.map((item) => item.sort_order)).toEqual([0, 1, 2]);
  });

  it("lämnar listan orörd vid ogiltig flytt", () => {
    expect(moveItem(items, 0, -1).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("skapar kopietitel", () => {
    expect(copyTitle("Tisdagsträning")).toBe("Kopia av Tisdagsträning");
  });

  it("bygger delar från en redaktionell mall utan att ändra originalet", () => {
    const template = {
      id: "pass-1",
      title: "Passningspass",
      total_minutes: 60,
      theme: "Passning",
      data: {
        id: "pass-1",
        title: "Passningspass",
        blocks: [
          { order: 2, minutes: 20, activity: "Spelövning", kind: "drill", drillId: "drill-2" },
          { order: 1, minutes: 10, activity: "Uppvärmning", kind: "warmup" },
        ],
      },
    } as unknown as TrainingSessionCard;

    const result = templateItems(template);
    expect(result.map((item) => item.title)).toEqual(["Uppvärmning", "Spelövning"]);
    expect(result[0]?.kind).toBe("custom");
    expect(result[1]?.resource_id).toBe("drill-2");
    expect(template.data.blocks[0]?.order).toBe(2);
  });
});
