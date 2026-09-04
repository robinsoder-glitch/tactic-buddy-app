import { describe, expect, it } from "vitest";
import { countOpenInvites } from "@/hooks/useOpenInvites";

const now = new Date("2026-09-04T12:00:00Z");
const future = "2026-09-10T17:00:00Z";

function invite(over: Partial<Record<string, unknown>> = {}) {
  return {
    status: "pending",
    memberUserId: "user-a",
    player_id: "p1",
    event: { starts_at: future, cancelled_at: null, invites_closed_at: null },
    ...over,
  } as never;
}

describe("countOpenInvites", () => {
  it("räknar egna obesvarade kallelser", () => {
    expect(countOpenInvites([invite()], now, { userId: "user-a" })).toBe(1);
  });

  it("räknar barnets kallelse även när personen är tränare i ett annat lag", () => {
    const child = invite({ memberUserId: null, player_id: "barn-1" });
    expect(countOpenInvites([child], now, { userId: "user-a", guardedPlayerIds: ["barn-1"] })).toBe(
      1,
    );
  });

  it("räknar inte andras kallelser", () => {
    const other = invite({ memberUserId: "user-b", player_id: "p9" });
    expect(countOpenInvites([other], now, { userId: "user-a", guardedPlayerIds: [] })).toBe(0);
  });

  it("räknar inte inställda eller stängda kallelser", () => {
    const cancelled = invite({
      event: { starts_at: future, cancelled_at: "2026-09-05T00:00:00Z", invites_closed_at: null },
    });
    const closed = invite({
      event: { starts_at: future, cancelled_at: null, invites_closed_at: "2026-09-05T00:00:00Z" },
    });
    expect(countOpenInvites([cancelled, closed], now, { userId: "user-a" })).toBe(0);
  });

  it("räknar inte passerade matcher eller besvarade kallelser", () => {
    const past = invite({
      event: { starts_at: "2026-09-01T17:00:00Z", cancelled_at: null, invites_closed_at: null },
    });
    expect(
      countOpenInvites([past, invite({ status: "attending" })], now, { userId: "user-a" }),
    ).toBe(0);
  });
});
