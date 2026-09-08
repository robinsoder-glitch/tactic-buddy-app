import { describe, expect, it } from "vitest";
import { reorderRows } from "./planning";

const rows = [
  { id: "a", sort_order: 0 },
  { id: "b", sort_order: 0 },
  { id: "c", sort_order: 3 },
];

describe("reorderRows", () => {
  it("flyttar en rad nedåt och numrerar om", () => {
    const next = reorderRows(rows, 0, 1);
    expect(next.map((row) => row.id)).toEqual(["b", "a", "c"]);
    expect(next.map((row) => row.sort_order)).toEqual([0, 1, 2]);
  });

  it("normaliserar lika platser även när flytten inte går", () => {
    expect(reorderRows(rows, 0, -1).map((row) => row.sort_order)).toEqual([0, 1, 2]);
  });
});
