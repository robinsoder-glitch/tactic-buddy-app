import { describe, expect, it } from "vitest";
import { buildFunnel, FAMILY_FUNNEL } from "./flow-tracking";

describe("buildFunnel", () => {
  it("räknar tappet mellan stegen", () => {
    const rows = buildFunnel({
      invite_opened: 100,
      invite_signup_clicked: 70,
      invite_signed_in: 60,
      invite_join_submitted: 55,
      invite_join_approved: 40,
    });
    expect(rows.map((row) => row.count)).toEqual([100, 70, 60, 55, 40]);
    expect(rows.map((row) => row.dropoff)).toEqual([0, 30, 10, 5, 15]);
  });

  it("hanterar saknade händelser som noll", () => {
    const rows = buildFunnel({ invite_opened: 5 });
    expect(rows).toHaveLength(FAMILY_FUNNEL.length);
    expect(rows[1]?.count).toBe(0);
    expect(rows[1]?.dropoff).toBe(5);
    expect(rows[2]?.dropoff).toBe(0);
  });
});
