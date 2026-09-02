import { describe, expect, it } from "vitest";
import { currentItemSeconds, formatClock, remainingSeconds, runElapsedSeconds, runSummary } from "./session-runs";

const start = "2026-09-03T17:00:00.000Z";
const now = Date.parse("2026-09-03T17:10:00.000Z");

describe("timern i genomförandet", () => {
  it("räknar tiden från starten", () => {
    expect(runElapsedSeconds({ started_at: start, paused_at: null, paused_seconds: 0, ended_at: null }, now)).toBe(600);
  });

  it("drar bort avslutade pauser", () => {
    expect(runElapsedSeconds({ started_at: start, paused_at: null, paused_seconds: 120, ended_at: null }, now)).toBe(
      480,
    );
  });

  it("står stilla under en pågående paus", () => {
    const paused = { started_at: start, paused_at: "2026-09-03T17:05:00.000Z", paused_seconds: 0, ended_at: null };
    expect(runElapsedSeconds(paused, now)).toBe(300);
  });

  it("stannar vid sluttiden", () => {
    const done = { started_at: start, paused_at: null, paused_seconds: 0, ended_at: "2026-09-03T17:07:00.000Z" };
    expect(runElapsedSeconds(done, now)).toBe(420);
  });

  it("blir aldrig negativ", () => {
    expect(runElapsedSeconds({ started_at: start, paused_at: null, paused_seconds: 9999, ended_at: null }, now)).toBe(0);
  });
});

describe("aktuellt moment", () => {
  const run = { started_at: start, paused_at: null, paused_seconds: 0, ended_at: null, current_index: 2 };
  const items = [{ actual_seconds: 300 }, { actual_seconds: 120 }, { actual_seconds: 0 }];

  it("räknar bort tiden för tidigare moment", () => {
    expect(currentItemSeconds(run, items, now)).toBe(180);
  });

  it("visar tid kvar och övertid", () => {
    expect(remainingSeconds(5, 180)).toBe(120);
    expect(remainingSeconds(2, 180)).toBe(-60);
  });
});

describe("klocka och sammanfattning", () => {
  it("visar mm:ss och timmar vid långa pass", () => {
    expect(formatClock(65)).toBe("01:05");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-70)).toBe("-01:10");
  });

  it("summerar planerad och faktisk tid", () => {
    const summary = runSummary([
      { planned_minutes: 10, actual_seconds: 660, status: "done" },
      { planned_minutes: 5, actual_seconds: 0, status: "skipped" },
    ]);
    expect(summary.plannedSeconds).toBe(900);
    expect(summary.actualSeconds).toBe(660);
    expect(summary.done).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.diffSeconds).toBe(-240);
  });
});
