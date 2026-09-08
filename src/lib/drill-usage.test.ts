import { describe, expect, it } from "vitest";
import { sortUsage, usageDateLabel, usageSummary, type DrillUsage } from "./drill-usage";

const row = (over: Partial<DrillUsage>): DrillUsage => ({
  id: "1",
  source: "session",
  title: "Pass",
  date: "2026-09-01T17:00:00Z",
  done: false,
  ...over,
});

describe("drill-usage", () => {
  it("sammanfattar planerade och genomförda gånger", () => {
    expect(usageSummary([])).toBe("Du har inte använt övningen ännu.");
    expect(
      usageSummary([
        row({ id: "a" }),
        row({ id: "b", source: "event" }),
        row({ id: "c", source: "run", done: true }),
      ]),
    ).toBe("Planerad 2 gånger, genomförd 1 gång.");
  });

  it("sorterar nyaste först och lägger rader utan datum sist", () => {
    const sorted = sortUsage([
      row({ id: "gammal", date: "2026-01-01T10:00:00Z" }),
      row({ id: "utan", date: null }),
      row({ id: "ny", date: "2026-09-05T10:00:00Z" }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["ny", "gammal", "utan"]);
  });

  it("visar en läsbar datumtext", () => {
    expect(usageDateLabel(null)).toBe("Utan datum");
    expect(usageDateLabel("2026-09-05T10:00:00Z")).toContain("2026");
  });
});
