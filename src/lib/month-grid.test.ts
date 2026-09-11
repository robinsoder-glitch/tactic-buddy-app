import { describe, expect, it } from "vitest";
import { dayKey, groupByDay, monthGrid, monthLabel, shiftMonth } from "./month-grid";

describe("månadskalender", () => {
  it("börjar rutnätet på måndag", () => {
    const grid = monthGrid({ year: 2026, month: 8 }); // september 2026
    expect(grid[0]?.key).toBe("2026-08-31");
    expect(grid[0]?.inMonth).toBe(false);
    expect(grid.some((day) => day.key === "2026-09-01" && day.inMonth)).toBe(true);
  });

  it("innehåller hela veckor", () => {
    for (let month = 0; month < 12; month += 1) {
      expect(monthGrid({ year: 2026, month }).length % 7).toBe(0);
    }
  });

  it("byter månad över årsskiftet", () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(monthLabel({ year: 2026, month: 0 })).toBe("januari 2026");
  });

  it("grupperar aktiviteter på lokal dag", () => {
    const day = new Date(2026, 8, 12, 18, 0);
    const grouped = groupByDay([{ starts_at: day.toISOString() }]);
    expect(grouped.get(dayKey(day))?.length).toBe(1);
  });
});
