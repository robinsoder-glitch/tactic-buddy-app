import { CheckCircle2, CircleAlert } from "lucide-react";
import { planStatusLabel, type PlanStatus } from "@/lib/plan-status";

/** Samma badge används i alla vyer så statusen aldrig ser olika ut. */
export function PlanStatusBadge({
  status,
  className = "",
}: {
  status: PlanStatus;
  className?: string;
}) {
  const done = status === "done";
  const Icon = done ? CheckCircle2 : CircleAlert;
  return (
    <span
      data-status={status}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
        done
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
          : "bg-destructive/15 text-destructive"
      } ${className}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {planStatusLabel(status)}
    </span>
  );
}

/**
 * Visas medan underlaget hämtas så att ingen hinner se en felaktig status
 * som sedan byts ut när svaren kommer in.
 */
export function PlanStatusBadgePending({ className = "" }: { className?: string }) {
  return (
    <span
      data-status="loading"
      aria-live="polite"
      className={`inline-flex shrink-0 animate-pulse items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground ${className}`}
    >
      Hämtar status…
    </span>
  );
}

/** Färgad markering till vänster i listorna. */
export function planStatusBar(status: PlanStatus): string {
  return status === "done" ? "bg-emerald-500" : "bg-destructive";
}
