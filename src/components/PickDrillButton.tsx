import { useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddToTrainingButton } from "@/components/AddToTrainingDialog";
import { fetchUpcomingEvents } from "@/lib/event-planning";
import { addPickToDraft, parsePickSearch } from "@/lib/training-pick";
import { formatDateTime } from "@/lib/teams";

type Props = {
  kind: "drill" | "goalkeeper";
  resourceId: string;
  title: string;
  defaultMinutes?: number;
  size?: "sm" | "default";
};

/**
 * Visar "Lägg till i denna träning" när Träningsbanken öppnats från en
 * träningsplanering, annars den vanliga dialogen för att välja aktivitet.
 */
export function PickDrillButton({ kind, resourceId, title, defaultMinutes = 10, size = "sm" }: Props) {
  const search = parsePickSearch(useSearch({ strict: false }) as Record<string, unknown>);
  const navigate = useNavigate();
  const [duplicate, setDuplicate] = useState(false);
  const [minutes, setMinutes] = useState(String(defaultMinutes));
  const events = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: () => fetchUpcomingEvents(),
    enabled: !!search.eventId,
  });

  if (!search.eventId) {
    return (
      <AddToTrainingButton
        kind={kind}
        resourceId={resourceId}
        title={title}
        defaultMinutes={defaultMinutes}
        size={size}
      />
    );
  }

  const eventId = search.eventId;
  const event = (events.data ?? []).find((row) => row.id === eventId) ?? null;

  function back() {
    navigate({ to: "/planera-traning", search: { eventId, mode: "edit" } });
  }

  function add(allowDuplicate: boolean) {
    const added = addPickToDraft(
      eventId,
      { kind, resourceId, title, minutes: Number(minutes) || defaultMinutes },
      { allowDuplicate },
    );
    if (!added) {
      setDuplicate(true);
      return;
    }
    toast.success(`${title} lades till i träningen.`);
    setDuplicate(false);
    back();
  }

  return (
    <>
      <span className="inline-flex items-center gap-2">
        <Button size={size} onClick={() => add(false)}>
          Lägg till i denna träning
        </Button>
        <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="number"
            min={5}
            max={60}
            aria-label="Antal minuter"
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            className="h-9 w-16 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
          min
        </label>
      </span>
      {event && <span className="ml-2 text-xs text-muted-foreground">{formatDateTime(event.starts_at)}</span>}

      <Dialog open={duplicate} onOpenChange={setDuplicate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Övningen finns redan i träningen. Vill du lägga till den en gång till?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDuplicate(false)}>
              Avbryt
            </Button>
            <Button onClick={() => add(true)}>Lägg till igen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
