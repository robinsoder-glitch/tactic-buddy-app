import { describe, expect, it, vi } from "vitest";
import { emailDeliveryReceipt, invitationEmailTargets, saveWithEmail } from "./invitation-delivery";

describe("mejlkopia av kallelse", () => {
  it("meddelar endast nya mottagare när ändringsnotiser är bortvalda", () => {
    expect(
      invitationEmailTargets({ selected: ["ny"], active: ["befintlig"], notifyExisting: false }),
    ).toEqual(["ny"]);
    expect(
      invitationEmailTargets({
        selected: ["ny"],
        active: ["ny", "befintlig"],
        notifyExisting: true,
      }),
    ).toEqual(["ny", "befintlig"]);
  });

  it("skickar ingen mejlkopia om sparningen misslyckas", async () => {
    const send = vi.fn();
    await expect(
      saveWithEmail(async () => {
        throw new Error("sparfel");
      }, send),
    ).rejects.toThrow("sparfel");
    expect(send).not.toHaveBeenCalled();
  });

  it("bevarar kvittot på sparad kallelse vid utskicksfel", async () => {
    const saved = { id: "sparad" };
    const result = await saveWithEmail(
      async () => saved,
      async () => {
        throw new Error("nätfel");
      },
    );
    expect(result.plan).toBe(saved);
    expect(result.delivery.status).toBe("failed");
    expect(emailDeliveryReceipt(result.delivery)).toEqual({
      text: "Mejlkopian kunde inte skickas. Kallelsen finns kvar i appen.",
      warning: true,
    });
  });

  it("bevarar delresultat och varnar för överhoppade eller misslyckade utskick", async () => {
    const result = await saveWithEmail(
      async () => "sparad",
      async () => ({ sent: 2, skipped: 1, failed: 1 }),
    );
    expect(emailDeliveryReceipt(result.delivery)).toEqual({
      text: "E-post: 2 skickade, 1 överhoppade och 1 misslyckade.",
      warning: true,
    });
  });

  it("redovisar lyckad respektive bortvald mejlkopia utan leveransvarning", async () => {
    const sent = await saveWithEmail(
      async () => "sparad",
      async () => ({ sent: 2, skipped: 0, failed: 0 }),
    );
    const none = await saveWithEmail(async () => "sparad", null);
    expect(emailDeliveryReceipt(sent.delivery).warning).toBe(false);
    expect(none.delivery.status).toBe("not_requested");
  });
});
