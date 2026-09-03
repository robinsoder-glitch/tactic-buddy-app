import { describe, expect, it } from "vitest";
import {
  canAddFocusArea,
  currentPeriod,
  periodWeeks,
  previousPeriod,
  teamOverview,
  validatePeriod,
  type FocusArea,
  type Observation,
  type TeamPeriod,
} from "./period-plan";

const base = {
  name: "Höst 1",
  start_date: "2026-09-01",
  end_date: "2026-09-29",
  main_theme: "Spela ut från målvakt",
  sub_themes: ["Passa och ta emot"],
};

describe("periodblock", () => {
  it("räknar antal veckor", () => {
    expect(periodWeeks({ start_date: "2026-09-01", end_date: "2026-09-29" })).toBe(4);
  });

  it("godkänner en period på fyra till sex veckor", () => {
    expect(validatePeriod(base)).toBeNull();
  });

  it("stoppar för korta och för långa perioder", () => {
    expect(validatePeriod({ ...base, end_date: "2026-09-10" })).toMatch(/fyra och sex veckor/);
    expect(validatePeriod({ ...base, end_date: "2026-11-01" })).toMatch(/fyra och sex veckor/);
  });

  it("stoppar fler än två delteman", () => {
    expect(validatePeriod({ ...base, sub_themes: ["a", "b", "c"] })).toMatch(/högst två delteman/);
  });

  it("kräver namn, tema och datum", () => {
    expect(validatePeriod({ ...base, name: " " })).toMatch(/namn/);
    expect(validatePeriod({ ...base, main_theme: "" })).toMatch(/huvudtema/);
    expect(validatePeriod({ ...base, start_date: "" })).toMatch(/datum/);
  });
});

const periods: TeamPeriod[] = [
  {
    id: "1",
    team_id: "t",
    name: "P1",
    start_date: "2026-08-01",
    end_date: "2026-08-29",
    main_theme: "A",
    sub_themes: [],
    goal: null,
  },
  {
    id: "2",
    team_id: "t",
    name: "P2",
    start_date: "2026-09-01",
    end_date: "2026-09-29",
    main_theme: "B",
    sub_themes: [],
    goal: null,
  },
];

describe("perioder i tiden", () => {
  it("hittar pågående period", () => {
    expect(currentPeriod(periods, new Date("2026-09-10"))?.id).toBe("2");
    expect(currentPeriod(periods, new Date("2026-10-10"))).toBeNull();
  });

  it("hittar föregående period", () => {
    expect(previousPeriod(periods, periods[1]!)?.id).toBe("1");
    expect(previousPeriod(periods, periods[0]!)).toBeNull();
  });
});

describe("fokusområden", () => {
  it("tillåter högst tre aktiva", () => {
    expect(canAddFocusArea(2)).toBe(true);
    expect(canAddFocusArea(3)).toBe(false);
  });

  it("visar lagöversikt utan topplista", () => {
    const focus = [{ player_id: "a", status: "active" }] as FocusArea[];
    const observations = [{ player_id: "a", created_at: "2026-09-02T10:00:00Z" }] as Observation[];
    const overview = teamOverview({
      players: [
        { id: "a", name: "Alva" },
        { id: "b", name: "Bo" },
      ],
      focus,
      observations,
    });
    expect(overview.withFocus).toBe(1);
    expect(overview.withoutFocus).toBe(1);
    expect(overview.latestObservation.find((row) => row.id === "b")?.lastObservation).toBeNull();
  });
});
