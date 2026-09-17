/**
 * Flödesskiss för inbjudan och guidad start. Rena beräkningar – här finns
 * inga databasanrop. Syftet är att både familjen och tränaren direkt ska se
 * var i kedjan de befinner sig och vad som händer härnäst.
 */

import { START_STEP_IDS, type StartStepId } from "./team-onboarding";

export type FlowState = "done" | "current" | "upcoming";

export type FlowStep = {
  key: string;
  /** Kort rubrik i skissen. */
  title: string;
  /** En mening om vad som händer i steget. */
  hint: string;
  /** Vem som gör steget – familjen, tränaren eller appen. */
  actor: string;
  state: FlowState;
};

export type FamilyFlowInput = {
  signedIn: boolean;
  /** Ansökan är skickad till laget. */
  joined: boolean;
  /** Tränaren har godkänt kontot. */
  approved: boolean;
  /** Yngre lag: bara vårdnadshavare har konton. */
  guardianOnly: boolean;
};

/** Stegen familjen går igenom från klickad länk till svar på kallelsen. */
export function familyFlowSteps(input: FamilyFlowInput): FlowStep[] {
  const accountDone = input.signedIn;
  const joinDone = input.joined || input.approved;
  const approveDone = input.approved;

  const steps: Array<Omit<FlowStep, "state"> & { done: boolean }> = [
    {
      key: "open",
      title: "Du öppnar länken",
      hint: "Du ser vilket lag inbjudan gäller.",
      actor: "Du",
      done: true,
    },
    {
      key: "account",
      title: "Skapa konto",
      hint: input.guardianOnly
        ? "Du som vårdnadshavare skapar kontot. Barnet behöver inget eget konto."
        : "Spelaren eller en vårdnadshavare skapar kontot.",
      actor: "Du",
      done: accountDone,
    },
    {
      key: "join",
      title: "Skriv barnets namn",
      hint: "Namnet gör att tränaren vet vem du hör ihop med.",
      actor: "Du",
      done: joinDone,
    },
    {
      key: "approve",
      title: "Tränaren godkänner",
      hint: "Tränaren kopplar ditt konto till rätt spelare i truppen.",
      actor: "Tränaren",
      done: approveDone,
    },
    {
      key: "ready",
      title: "Kalender och kallelser",
      hint: "Ni ser alla träningar och matcher och svarar på kallelserna.",
      actor: "Du",
      done: false,
    },
  ];

  return withStates(steps);
}

const COACH_STEP_TEXT: Record<StartStepId, { title: string; hint: string; actor: string }> = {
  squad: {
    title: "Lägg in truppen",
    hint: "Skriv barnens namn, ett i taget.",
    actor: "Du",
  },
  invite: {
    title: "Dela inbjudan",
    hint: "Samma länk till alla familjer i laget.",
    actor: "Du",
  },
  approve: {
    title: "Godkänn familjerna",
    hint: "Ansökningarna dyker upp här när familjerna klickat på länken.",
    actor: "Du",
  },
  plan: {
    title: "Planera första aktiviteten",
    hint: "Tid, samling och plats syns direkt i familjernas kalender.",
    actor: "Du",
  },
  responses: {
    title: "Skicka kallelsen",
    hint: "Familjerna svarar i appen och du ser vilka som kommer.",
    actor: "Familjerna",
  },
};

/** Tränarens fem steg som en flödesskiss. */
export function coachFlowSteps(done: Record<StartStepId, boolean>): FlowStep[] {
  return withStates(
    START_STEP_IDS.map((id) => ({
      key: id,
      ...COACH_STEP_TEXT[id],
      done: done[id],
    })),
  );
}

/** Det steg som är på gång just nu, eller null när allt är klart. */
export function currentFlowStep(steps: FlowStep[]): FlowStep | null {
  return steps.find((step) => step.state === "current") ?? null;
}

/** Kort besked om vad som händer härnäst. */
export function nextStepText(steps: FlowStep[]): string {
  const current = currentFlowStep(steps);
  if (!current) return "Allt är klart.";
  return `Nu: ${current.title} – ${current.hint}`;
}

function withStates(steps: Array<Omit<FlowStep, "state"> & { done: boolean }>): FlowStep[] {
  const firstOpen = steps.findIndex((step) => !step.done);
  return steps.map(({ done, ...step }, index) => ({
    ...step,
    state: done ? "done" : index === firstOpen ? "current" : "upcoming",
  }));
}
