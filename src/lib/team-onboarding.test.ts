import { describe, expect, it } from "vitest";
import {
  nextStartStep,
  responsesText,
  startProgressText,
  startStepsDone,
  type StartProgressInput,
} from "./team-onboarding";

const empty: StartProgressInput = {
  players: 0,
  families: 0,
  approvedFamilies: 0,
  upcomingEvents: 0,
  invitesTotal: 0,
  invitesAnswered: 0,
};

const done: StartProgressInput = {
  players: 8,
  families: 6,
  approvedFamilies: 6,
  upcomingEvents: 2,
  invitesTotal: 8,
  invitesAnswered: 8,
};

describe("guidad start", () => {
  it("börjar med truppen", () => {
    expect(nextStartStep(empty)).toBe("squad");
    expect(startProgressText(empty)).toBe("0 av 5 steg klara");
  });

  it("går vidare steg för steg", () => {
    expect(nextStartStep({ ...empty, players: 3 })).toBe("invite");
    expect(nextStartStep({ ...empty, players: 3, families: 2 })).toBe("approve");
    expect(nextStartStep({ ...empty, players: 3, families: 2, approvedFamilies: 2 })).toBe("plan");
    expect(
      nextStartStep({
        ...empty,
        players: 3,
        families: 2,
        approvedFamilies: 2,
        upcomingEvents: 1,
        invitesTotal: 3,
      }),
    ).toBe("responses");
  });

  it("är klar när svaren har kommit in", () => {
    expect(nextStartStep(done)).toBeNull();
    expect(startStepsDone(done).responses).toBe(true);
    expect(startProgressText(done)).toMatch(/Alla steg är klara/);
  });

  it("beskriver kallelseläget", () => {
    expect(responsesText(0, 0)).toMatch(/Ingen kallelse/);
    expect(responsesText(5, 0)).toMatch(/Ingen har svarat/);
    expect(responsesText(5, 2)).toBe("2 av 5 har svarat.");
    expect(responsesText(5, 5)).toBe("Alla 5 har svarat.");
  });
});
