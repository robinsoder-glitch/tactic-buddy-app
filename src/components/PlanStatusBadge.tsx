import { CheckCircle2, CircleAlert } from "lucide-react";
import { planStatusLabel, type PlanStatus } from "@/lib/plan-status";

/** Samma badge används i alla vyer så statusen aldrig ser olika ut. */
export function PlanStatusBadge({ status, className = "" }: { status: PlanStatus; className?: string }) {
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

/** Färgad markering till vänster i listorna. */
export function planStatusBar(status: PlanStatus): string {
  return status === "done" ? "bg-emerald-500" : "bg-destructive";
}
