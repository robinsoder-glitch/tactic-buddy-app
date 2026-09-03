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
import { fetchCoachSessions } from "@/lib/coach-sessions";
import { fetchCoachDrills } from "@/lib/coach-drills";
import { fetchTactics } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  goalkeeper: "Målvaktsövning",
  article: "Artikel",
};

export function EventResources({ eventId, teamId, userId, isCoach }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const links = useQuery({
    queryKey: ["event-resources", eventId],
    queryFn: () => fetchEventResources([eventId]),
  });
  const tactics = useQuery({
    queryKey: ["tb-tactics"],
    queryFn: fetchTacticCards,
    enabled: open || links.isSuccess,
  });
  const drills = useQuery({
    queryKey: ["tb-drills"],
    queryFn: fetchDrills,
    enabled: open || links.isSuccess,
  });
  const sessions = useQuery({
    queryKey: ["tb-sessions"],
    queryFn: fetchTrainingSessions,
    enabled: open || links.isSuccess,
  });

  const coachSessions = useQuery({
    queryKey: ["coach-sessions"],
    queryFn: fetchCoachSessions,
    enabled: open || links.isSuccess,
  });

  const ownDrills = useQuery({
    queryKey: ["coach-drills"],
    queryFn: fetchCoachDrills,
    enabled: open || links.isSuccess,
  });

  const ownTactics = useQuery({
    queryKey: ["tactics"],
    queryFn: fetchTactics,
    enabled: open || links.isSuccess,
  });

  /** Sann när taktiken är en egen ritad taktik och inte ett kort ur banken. */
  function isOwnTactic(id: string) {
    return (ownTactics.data ?? []).some((item) => item.id === id);
  }

  /** Ett kopplat träningspass kan vara redaktionellt eller en tränares egen träning. */
  function isCoachSession(id: string) {
    return (coachSessions.data ?? []).some((item) => item.id === id);
  }

  function titleFor(kind: EventResourceKind, id: string) {
    if (kind === "session") {
      const own = (coachSessions.data ?? []).find((item) => item.id === id);
      if (own) return own.title;
    }
    if (kind === "tactic") {
      const own = (ownTactics.data ?? []).find((item) => item.id === id);
      if (own) return own.name;
    }
    if (kind === "drill") {
      const own = (ownDrills.data ?? []).find((item) => item.id === id);
      if (own) return own.title;
    }
    const source =
      kind === "tactic" ? tactics.data : kind === "drill" ? drills.data : sessions.data;
    return source?.find((item) => item.id === id)?.title ?? "Övning";
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
        <p className="flex items-center gap-1 text-xs tracking-wide text-muted-foreground">
          <BookOpen className="size-3" /> Planerat innehåll
        </p>
        {isCoach && userId && (
          <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
            <Plus className="size-4" /> Koppla
          </Button>
        )}
      </div>

      <ul className="mt-2 space-y-1">
        {items.length === 0 && <li className="text-xs text-muted-foreground">Inget kopplat än.</li>}
        {items.map((item, index) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"
          >
            <span className="text-xs text-muted-foreground">
              {index + 1}. {KIND_LABELS[item.kind]}
            </span>
            {item.kind === "session" && isCoachSession(item.resource_id) ? (
              <Link
                to="/traningspass/$id/visa"
                params={{ id: item.resource_id }}
                className="min-w-0 flex-1 truncate text-primary underline-offset-4 hover:underline"
              >
                {titleFor(item.kind, item.resource_id)}
              </Link>
            ) : item.kind === "tactic" && isOwnTactic(item.resource_id) ? (
              <Link
                to="/tactic/$id"
                params={{ id: item.resource_id }}
                className="min-w-0 flex-1 truncate text-primary underline-offset-4 hover:underline"
              >
                {titleFor(item.kind, item.resource_id)}
              </Link>
            ) : item.kind === "tactic" ? (
              <Link
                to="/taktikbank/$cardId"
                params={{ cardId: item.resource_id }}
                className="min-w-0 flex-1 truncate text-primary underline-offset-4 hover:underline"
              >
                {titleFor(item.kind, item.resource_id)}
              </Link>
            ) : (
              <span className="min-w-0 flex-1 truncate">
                {titleFor(item.kind, item.resource_id)}
              </span>
            )}
            {item.minutes ? (
              <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                {item.minutes} min
              </span>
            ) : null}
            {isCoach && (
              <button
                type="button"
                aria-label="Ta bort koppling"
                onClick={() => remove.mutate(item.id)}
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            )}
            {item.note && <p className="w-full text-xs text-muted-foreground">{item.note}</p>}
          </li>
        ))}
      </ul>

      {items.some((item) => item.minutes) && (
        <p className="mt-2 text-xs font-semibold">
          Total tid: {items.reduce((total, item) => total + (item.minutes ?? 0), 0)} minuter
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Koppla innehåll till träningen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button variant="secondary" className="w-full" asChild>
              <Link to="/traningspass">
                <Plus className="size-4" /> Skapa ett nytt träningspass
              </Link>
            </Button>

            {(
              [
                ["Mina träningspass", "session", coachSessions.data ?? []],
                ["Träningspass ur banken", "session", sessions.data ?? []],
                ["Övningar", "drill", drills.data ?? []],
                ["Taktikkort", "tactic", tactics.data ?? []],
              ] as [string, EventResourceKind, { id: string; title: string }[]][]
            ).map(([heading, kind, list]) => (
              <section key={heading}>
                <h3 className="font-display text-sm tracking-wide text-muted-foreground">
                  {heading}
                </h3>
                <ul className="mt-1 space-y-1">
                  {list.length === 0 && (
                    <li className="text-xs text-muted-foreground">Inget att välja här ännu.</li>
                  )}
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
