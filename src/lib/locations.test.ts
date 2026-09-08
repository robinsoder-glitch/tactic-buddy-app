import { describe, expect, it } from "vitest";
import { recentLocations } from "./locations";

const event = (location: string | null, starts_at: string) =>
  ({ location, starts_at }) as never;

describe("recentLocations", () => {
  it("hoppar över tomma platser", () => {
    expect(recentLocations([event(null, "2026-01-01"), event("  ", "2026-01-02")])).toEqual([]);
  });

  it("räknar samma plats med olika versaler som en", () => {
    const list = recentLocations([
      event("Sportfältet", "2026-01-01T10:00:00Z"),
      event("sportfältet", "2026-02-01T10:00:00Z"),
    ]);
    expect(list).toEqual(["sportfältet"]);
  });

  it("sorterar vanligast först och begränsar antalet", () => {
    const list = recentLocations(
      [
        event("Plan A", "2026-01-01T10:00:00Z"),
        event("Plan B", "2026-01-02T10:00:00Z"),
        event("Plan B", "2026-01-03T10:00:00Z"),
        event("Plan C", "2026-01-04T10:00:00Z"),
      ],
      2,
    );
    expect(list).toEqual(["Plan B", "Plan C"]);
  });
});
