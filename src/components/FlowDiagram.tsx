import { Check } from "lucide-react";
import { currentFlowStep, type FlowStep } from "@/lib/invite-flow";

/**
 * Enkel flödesskiss: alla steg i ordning, med tydlig markering av var man är
 * och vad som händer härnäst.
 */
export function FlowDiagram({ steps, title = "Så går det till" }: { steps: FlowStep[]; title?: string }) {
  const current = currentFlowStep(steps);

  return (
    <div className="rounded-xl border border-border bg-card p-4 text-left">
      <p className="text-sm font-semibold">{title}</p>
      <ol className="mt-3 space-y-0">
        {steps.map((step, index) => (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                aria-hidden
                className={`flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  step.state === "done"
                    ? "border-primary bg-primary text-primary-foreground"
                    : step.state === "current"
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-muted text-muted-foreground"
                }`}
              >
                {step.state === "done" ? <Check className="size-4" /> : index + 1}
              </span>
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className={`w-px flex-1 ${step.state === "done" ? "bg-primary" : "bg-border"}`}
                />
              )}
            </div>
            <div className={`pb-4 ${index === steps.length - 1 ? "pb-0" : ""}`}>
              <p
                className={`text-sm ${
                  step.state === "current"
                    ? "font-semibold text-foreground"
                    : step.state === "done"
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                }`}
              >
                {step.title}
                {step.state === "current" && (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    Du är här
                  </span>
                )}
                {step.state === "done" && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">Klart</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {step.actor}: {step.hint}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {current && (
        <p className="mt-1 rounded-lg bg-primary/10 p-3 text-sm font-semibold text-foreground">
          Nästa steg för dig: {current.title}
        </p>
      )}
    </div>
  );
}
