import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventStatusOverview } from "./EventStatusOverview";
import type { StepKey, StepStatus } from "@/lib/event-status";

const allDone: Record<StepKey, StepStatus> = {
  details: "done",
  invitation: "done",
  planning: "done",
  execution: "done",
  attendance: "done",
  followup: "done",
};

describe("EventStatusOverview", () => {
  it("visar kallelse för matcher", () => {
    render(<EventStatusOverview steps={allDone} type="match" />);
    expect(screen.getByText("Kallelse")).toBeVisible();
  });

  it("visar inte kallelse för träningar", () => {
    render(<EventStatusOverview steps={allDone} type="training" />);
    expect(screen.queryByText("Kallelse")).not.toBeInTheDocument();
  });

  it("döljer genomförande och uppföljning för alla aktiviteter", () => {
    render(<EventStatusOverview steps={allDone} type="training" />);
    expect(screen.queryByText("Genomförande")).not.toBeInTheDocument();
    expect(screen.queryByText("Uppföljning")).not.toBeInTheDocument();
  });
});
