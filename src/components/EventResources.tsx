import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookOpen, Plus, X } from "lucide-react";
import {
  addEventResource,
  fetchDrills,
  fetchEventResources,
  fetchTacticCards,
  fetchTrainingSessions,
  removeEventResource,
  type EventResourceKind,
} from "@/lib/taktikbank";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  eventId: string;
  teamId: string;
  userId: string | null;
  isCoach: boolean;
};

const KIND_LABELS: Record<EventResourceKind, string> = {
  tactic: "Taktikkort",
  drill: "Övning",
  session: "Träningspass",
};

export function EventResources({ eventId, teamId, userId, isCoach }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const links = useQuery({
    queryKey: ["event-resources", eventId],
    queryFn: () => fetchEventResources([eventId]),
  });
  const tactics = useQuery({ queryKey: ["tb-tactics"], queryFn: fetchTacticCards, enabled: open || links.isSuccess });
  const drills = useQuery({ queryKey: ["tb-drills"], queryFn: fetchDrills, enabled: open || links.isSuccess });
  const sessions = useQuery({
    queryKey: ["tb-sessions"],
    queryFn: fetchTrainingSessions,
    enabled: open || links.isSuccess,
  });

  function titleFor(kind: EventResourceKind, id: string) {
    const source =
      kind === "tactic" ? tactics.data : kind === "drill" ? drills.data : sessions.data;
    return source?.find((item) => item.id === id)?.title ?? id;
  }

  const add = useMutation({
    mutationFn: (input: { kind: EventResourceKind; resourceId: string }) =>
      addEventResource({ eventId, teamId, userId: userId!, ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-resources", eventId] });
      setOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Kunde inte koppla"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeEventResource(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event-resources", eventId] }),
  });

  const items = links.data ?? [];

  if (!isCoach && items.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
          <BookOpen className="size-3" /> Från taktikbanken
        </p>
        {isCoach && userId && (
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Koppla
          </Button>
        )}
      </div>

      <ul className="mt-2 space-y-1">
        {items.length === 0 && <li className="text-xs text-muted-foreground">Inget kopplat än.</li>}
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span className="text-xs uppercase text-muted-foreground">{KIND_LABELS[item.kind]}</span>
            {item.kind === "tactic" ? (
              <Link
                to="/taktikbank/$cardId"
                params={{ cardId: item.resource_id }}
                className="min-w-0 flex-1 truncate text-primary underline-offset-4 hover:underline"
              >
                {titleFor(item.kind, item.resource_id)}
              </Link>
            ) : (
              <span className="min-w-0 flex-1 truncate">{titleFor(item.kind, item.resource_id)}</span>
            )}
            {isCoach && (
              <button type="button" aria-label="Ta bort koppling" onClick={() => remove.mutate(item.id)}>
                <X className="size-4 text-muted-foreground" />
              </button>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Koppla innehåll till träningen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(
              [
                ["tactic", tactics.data ?? []],
                ["drill", drills.data ?? []],
                ["session", sessions.data ?? []],
              ] as [EventResourceKind, { id: string; title: string }[]][]
            ).map(([kind, list]) => (
              <section key={kind}>
                <h3 className="font-display text-sm uppercase tracking-wide text-muted-foreground">
                  {KIND_LABELS[kind]}
                </h3>
                <ul className="mt-1 space-y-1">
                  {list.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary"
                        onClick={() => add.mutate({ kind, resourceId: item.id })}
                      >
                        {item.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
