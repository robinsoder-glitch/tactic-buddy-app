import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import {
  addResourceToEvent,
  eventOptionLabel,
  fetchUpcomingEvents,
  type PlanKind,
} from "@/lib/event-planning";
import { fetchMyMemberships } from "@/lib/teams";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Knapp som lägger innehåll från banken direkt på en träning eller match i kalendern. */
export function AddToTrainingButton({
  kind,
  resourceId,
  title,
  defaultMinutes = 10,
  size = "default",
}: {
  kind: PlanKind;
  resourceId: string;
  title: string;
  defaultMinutes?: number;
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const events = useQuery({ queryKey: ["upcoming-events"], queryFn: () => fetchUpcomingEvents(), enabled: open });
  const memberships = useQuery({ queryKey: ["my-memberships"], queryFn: fetchMyMemberships, enabled: open });

  const [eventId, setEventId] = useState("");
  const [minutes, setMinutes] = useState(String(defaultMinutes));
  const [note, setNote] = useState("");

  const coachTeams = useMemo(
    () =>
      new Set(
        (memberships.data ?? [])
          .filter((item) => item.role === "coach" && item.status === "approved")
          .map((item) => item.team_id),
      ),
    [memberships.data],
  );

  const options = useMemo(
    () => (events.data ?? []).filter((event) => coachTeams.has(event.team_id)),
    [events.data, coachTeams],
  );

  const selected = options.find((event) => event.id === eventId) ?? options[0];

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Du måste vara inloggad.");
      if (!selected) throw new Error("Välj en träning eller match först.");
      await addResourceToEvent({
        eventId: selected.id,
        teamId: selected.team_id,
        userId: user.id,
        kind,
        resourceId,
        minutes: Number(minutes) || null,
        note,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-resources"] });
      setOpen(false);
      setNote("");
      toast.success("Innehållet lades till i aktivitetens plan.");
    },
    onError: (error: Error) => toast.error(error.message || "Det gick inte att lägga till innehållet."),
  });

  return (
    <>
      <Button
        variant="outline"
        size={size}
        aria-label={`Lägg till ${title} i en träning`}
        onClick={() => setOpen(true)}
      >
        <CalendarClock className="size-4" /> Lägg till i träning
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lägg till i träning</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{title}</p>

            {events.isLoading || memberships.isLoading ? (
              <p className="text-sm text-muted-foreground">Hämtar kommande aktiviteter…</p>
            ) : options.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Det finns inga kommande träningar eller matcher i dina lag. Lägg först in en aktivitet i lagets
                kalender.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="plan-event">Träning eller match</Label>
                  <select
                    id="plan-event"
                    className={selectClass}
                    value={selected?.id ?? ""}
                    onChange={(event) => setEventId(event.target.value)}
                  >
                    {options.map((event) => (
                      <option key={event.id} value={event.id}>
                        {eventOptionLabel(event)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="plan-minutes">Antal minuter</Label>
                  <Input
                    id="plan-minutes"
                    type="number"
                    min={0}
                    max={180}
                    value={minutes}
                    onChange={(event) => setMinutes(event.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="plan-note">Anteckning (valfritt)</Label>
                  <Input
                    id="plan-note"
                    value={note}
                    placeholder="T.ex. kör efter uppvärmningen"
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>

                <Button className="w-full" disabled={add.isPending} onClick={() => add.mutate()}>
                  {add.isPending ? "Lägger till…" : "Lägg till i aktiviteten"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
