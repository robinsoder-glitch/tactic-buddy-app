import { describe, expect, it } from "vitest";
import { coachFlowSteps, currentFlowStep, familyFlowSteps, nextStepText } from "./invite-flow";

describe("familyFlowSteps", () => {
  it("pekar på kontoskapande innan man loggat in", () => {
    const steps = familyFlowSteps({
      signedIn: false,
      joined: false,
      approved: false,
      guardianOnly: true,
    });
    expect(currentFlowStep(steps)?.key).toBe("account");
    expect(steps[0]?.state).toBe("done");
  });

  it("pekar på barnets namn när kontot finns", () => {
    const steps = familyFlowSteps({
      signedIn: true,
      joined: false,
      approved: false,
      guardianOnly: true,
    });
    expect(currentFlowStep(steps)?.key).toBe("join");
  });

  it("väntar på tränarens godkännande efter ansökan", () => {
    const steps = familyFlowSteps({
      signedIn: true,
      joined: true,
      approved: false,
      guardianOnly: true,
    });
    expect(currentFlowStep(steps)?.key).toBe("approve");
    expect(nextStepText(steps)).toContain("Tränaren godkänner");
  });

  it("landar i kalender och kallelser när allt är klart", () => {
    const steps = familyFlowSteps({
      signedIn: true,
      joined: true,
      approved: true,
      guardianOnly: false,
    });
    expect(currentFlowStep(steps)?.key).toBe("ready");
    expect(steps[1]?.hint).toContain("Spelaren eller en vårdnadshavare");
  });
});

describe("coachFlowSteps", () => {
  it("markerar första ogjorda steget som aktuellt", () => {
    const steps = coachFlowSteps({
      squad: true,
      invite: false,
      approve: false,
      plan: false,
      responses: false,
    });
    expect(steps.map((step) => step.state)).toEqual([
      "done",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
  });

  it("saknar aktuellt steg när allt är klart", () => {
    const steps = coachFlowSteps({
      squad: true,
      invite: true,
      approve: true,
      plan: true,
      responses: true,
    });
    expect(currentFlowStep(steps)).toBeNull();
    expect(nextStepText(steps)).toBe("Allt är klart.");
  });
});
