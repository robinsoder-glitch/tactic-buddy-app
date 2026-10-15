export type InvitationEmailResult = { sent: number; skipped: number; failed: number };

export type EmailDelivery =
  | { status: "not_requested" }
  | { status: "completed"; result: InvitationEmailResult }
  | { status: "failed" };

/** Befintliga mottagare får en mejlkopia bara när ledaren vill meddela dem. */
export function invitationEmailTargets(input: {
  selected: string[];
  active: string[];
  notifyExisting: boolean;
}): string[] {
  return [...new Set([...input.selected, ...(input.notifyExisting ? input.active : [])])];
}

/** En misslyckad mejlkopia får aldrig göra en redan sparad kallelse osynlig. */
export async function saveWithEmail<T>(
  save: () => Promise<T>,
  send: (() => Promise<InvitationEmailResult>) | null,
): Promise<{ plan: T; delivery: EmailDelivery }> {
  const plan = await save();
  if (!send) return { plan, delivery: { status: "not_requested" } };
  try {
    return { plan, delivery: { status: "completed", result: await send() } };
  } catch {
    return { plan, delivery: { status: "failed" } };
  }
}

export function emailDeliveryReceipt(delivery: EmailDelivery): { text: string; warning: boolean } {
  if (delivery.status === "not_requested")
    return { text: "Ingen mejlkopia skickades.", warning: false };
  if (delivery.status === "failed") {
    return { text: "Mejlkopian kunde inte skickas. Kallelsen finns kvar i appen.", warning: true };
  }
  const { sent, skipped, failed } = delivery.result;
  return {
    text: `E-post: ${sent} skickade, ${skipped} överhoppade och ${failed} misslyckade.`,
    warning: skipped > 0 || failed > 0,
  };
}
