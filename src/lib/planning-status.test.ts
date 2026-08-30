import { describe, expect, it } from "vitest";
import { planningStatus, type EventPlan } from "@/lib/planning";

const plan = (event_id: string, done: boolean): EventPlan => ({
  event_id,
  team_id: "t1",
  notes: null,
  planning_done: done,
});

describe("planningStatus", () => {
  it("visar planerad när tränaren bockat i att planeringen är klar", () => {
    expect(planningStatus("e1", [plan("e1", true)], [])).toBe("done");
  });

  it("visar påbörjad när innehåll finns men planeringen inte är klarmarkerad", () => {
    expect(planningStatus("e1", [plan("e1", false)], [{ event_id: "e1" }])).toBe("started");
  });

  it("visar oplanerad när ingenting är gjort", () => {
    expect(planningStatus("e1", [], [{ event_id: "e2" }])).toBe("none");
  });
});
