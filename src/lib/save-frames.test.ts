import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();
const from = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpc(...args),
    from: (...args: unknown[]) => from(...args),
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null }) }) },
  },
}));

const { saveFrames } = await import("./db");

/**
 * Sparandet går via en databasfunktion som kör allt i en transaktion. Ett
 * sparfel får aldrig radera tidigare sekvenser, och klienten får inte ta bort
 * steg på egen hand.
 */
describe("saveFrames sparar atomiskt", () => {
  beforeEach(() => {
    rpc.mockReset();
    from.mockReset();
  });

  it("skickar stegen i ordning till databasfunktionen", async () => {
    rpc.mockResolvedValue({ data: 2, error: null });
    await saveFrames("t1", "u1", [
      { id: "a", name: "Steg 1", note: null, objects: [], drawings: [] },
      { id: "b", name: "Steg 2", note: "x", objects: [], drawings: [] },
    ]);

    expect(from).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0] as [string, { _frames: { name: string }[] }];
    expect(fn).toBe("save_tactic_frames");
    expect(args._frames.map((f) => f.name)).toEqual(["Steg 1", "Steg 2"]);
  });

  it("kastar fel utan att röra tabellerna när sparandet misslyckas", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "nej" } });
    await expect(
      saveFrames("t1", "u1", [{ id: "a", name: "Steg 1", note: null, objects: [], drawings: [] }]),
    ).rejects.toThrow("nej");
    expect(from).not.toHaveBeenCalled();
  });
});
