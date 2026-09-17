/**
 * Guidad start för ett nytt lag. Rena beräkningar av hur långt tränaren
 * har kommit – inga databasanrop här.
 */

export type StartStepId = "squad" | "invite" | "approve" | "plan" | "responses";

export const START_STEP_IDS: StartStepId[] = ["squad", "invite", "approve", "plan", "responses"];

export type StartProgressInput = {
  /** Antal spelare i truppen. */
  players: number;
  /** Familjer som ansökt eller redan är med (inte tränare). */
  families: number;
  /** Familjer som tränaren godkänt. */
  approvedFamilies: number;
  /** Kommande träningar och matcher. */
  upcomingEvents: number;
  /** Publicerade kallelser i laget. */
  invitesTotal: number;
  /** Kallelser som fått svar. */
  invitesAnswered: number;
};

export function startStepsDone(input: StartProgressInput): Record<StartStepId, boolean> {
  return {
    squad: input.players > 0,
    invite: input.families > 0,
    approve: input.approvedFamilies > 0,
    plan: input.upcomingEvents > 0,
    responses: input.invitesAnswered > 0,
  };
}

/** Första steget som återstår, eller null när allt är klart. */
export function nextStartStep(input: StartProgressInput): StartStepId | null {
  const done = startStepsDone(input);
  return START_STEP_IDS.find((id) => !done[id]) ?? null;
}

export function startProgressText(input: StartProgressInput): string {
  const done = startStepsDone(input);
  const count = START_STEP_IDS.filter((id) => done[id]).length;
  return count === START_STEP_IDS.length
    ? "Alla steg är klara. Laget är i gång."
    : `${count} av ${START_STEP_IDS.length} steg klara`;
}

/** Kort besked om kallelseläget, skrivet så en tränare förstår. */
export function responsesText(total: number, answered: number): string {
  if (total === 0) return "Ingen kallelse är skickad ännu.";
  if (answered === 0) return `${total} kallelser är skickade. Ingen har svarat ännu.`;
  if (answered >= total) return `Alla ${total} har svarat.`;
  return `${answered} av ${total} har svarat.`;
}
