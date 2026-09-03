import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { fetchEventPlan, saveEventPlan } from "@/lib/planning";

type Props = {
  eventId: string;
  teamId: string;
  userId: string | null;
  isCoach: boolean;
};

/** Tränaren markerar när planeringen av träningen är klar. */
export function PlanningDoneToggle({ eventId, teamId, userId, isCoach }: Props) {
  const queryClient = useQueryClient();
  const plan = useQuery({
    queryKey: ["event-plan", eventId],
    queryFn: () => fetchEventPlan(eventId),
  });
  const done = Boolean(plan.data?.planning_done);

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      if (!userId) throw new Error("Du måste vara inloggad.");
      await saveEventPlan({
        eventId,
        teamId,
        userId,
        notes: plan.data?.notes ?? null,
        planningDone: next,
      });
    },
    onSuccess: (_data, next) => {
      queryClient.invalidateQueries({ queryKey: ["event-plan"] });
      queryClient.invalidateQueries({ queryKey: ["event-plans"] });
      toast.success(next ? "Planeringen är markerad som klar." : "Planeringen är åter öppen.");
    },
    onError: () => toast.error("Det gick inte att spara statusen."),
  });

  if (!isCoach) {
    return done ? (
      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="size-3.5" /> Planeringen är klar
      </p>
    ) : null;
  }

  return (
    <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
      <input
        type="checkbox"
        className="sr-only"
        checked={done}
        disabled={toggle.isPending}
        onChange={(event) => toggle.mutate(event.target.checked)}
      />
      {done ? (
        <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : (
        <Circle className="size-5 text-muted-foreground" aria-hidden />
      )}
      <span className={done ? "font-semibold text-emerald-700 dark:text-emerald-300" : ""}>
        Planeringen är klar
      </span>
    </label>
  );
}
