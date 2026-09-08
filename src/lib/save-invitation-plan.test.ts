import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: () => {
      throw new Error("Kallelser får inte skrivas direkt från klienten.");
    },
  },
}));

const { saveInvitationPlan } = await import("./invitations");

describe("saveInvitationPlan", () => {
  beforeEach(() => rpc.mockReset());

  it("sparar allt i ett enda databasanrop", async () => {
    rpc.mockResolvedValue({ data: { added: 2, updated: 3, notified: 1 }, error: null });
    const result = await saveInvitationPlan({
      eventId: "e1",
      hasExisting: true,
      newPlayerIds: ["p1", "p2"],
      message: "Hej",
      respondBy: "2026-10-01",
      notify: true,
      operationId: "op-1",
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe("save_invitation_plan");
    expect(args["_new_player_ids"]).toEqual(["p1", "p2"]);
    expect(args["_update_existing"]).toBe(true);
    expect(args["_op_id"]).toBe("op-1");
    expect(result.added).toBe(2);
    expect(result.updated).toBe(3);
  });

  it("skickar samma handlings-id vid dubbelklick så inga dubbletter skapas", async () => {
    rpc.mockResolvedValue({ data: { added: 1, updated: 0 }, error: null });
    const input = {
      eventId: "e1",
      hasExisting: false,
      newPlayerIds: ["p1"],
      message: null,
      operationId: "op-2",
    };
    await saveInvitationPlan(input);
    await saveInvitationPlan(input);
    const ids = rpc.mock.calls.map((c) => (c[1] as Record<string, unknown>)["_op_id"]);
    expect(ids).toEqual(["op-2", "op-2"]);
  });

  it("kastar fel om databasen avvisar sparandet", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Matchen är inställd." } });
    await expect(
      saveInvitationPlan({
        eventId: "e1",
        hasExisting: true,
        newPlayerIds: [],
        message: null,
      }),
    ).rejects.toMatchObject({ message: "Matchen är inställd." });
  });
});
