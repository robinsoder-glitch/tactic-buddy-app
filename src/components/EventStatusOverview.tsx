import {
  STEP_LABELS,
  STEP_ORDER,
  STEP_STATUS_LABELS,
  stepHint,
  type StepKey,
  type StepStatus,
} from "@/lib/event-status";

const TONE: Record<StepStatus, string> = {
  done: "border-primary/40 bg-primary/10 text-primary",
  in_progress: "border-border bg-secondary/60 text-foreground",
  needs_action: "border-destructive/40 bg-destructive/10 text-destructive",
  not_started: "border-dashed border-border bg-card text-muted-foreground",
  not_applicable: "border-border bg-card text-muted-foreground",
};

/**
 * Kompakt lägesöversikt. På mobil visas stegen som staplade kort,
 * aldrig som en horisontell stegindikator.
 */
/** Steg som inte visas i aktivitetsvyn – de gjorde översikten rörig. */
const HIDDEN_STEPS: StepKey[] = ["execution", "followup"];

export function EventStatusOverview({ steps }: { steps: Record<StepKey, StepStatus> }) {
  const visible = STEP_ORDER.filter((step) => !HIDDEN_STEPS.includes(step));
  return (
    <section className="mt-5" aria-label="Lägesöversikt">
      <h2 className="text-sm font-semibold">Lägesöversikt</h2>
      <ol className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((step, index) => {
          const status = steps[step];
          return (
            <li key={step} className={`rounded-xl border p-3 ${TONE[status]}`}>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                {index + 1}. {STEP_LABELS[step]}
              </p>
              <p className="mt-1 text-sm font-semibold">{STEP_STATUS_LABELS[status]}</p>
              <p className="text-xs opacity-80">{stepHint(step, status)}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
