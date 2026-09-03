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
import {
  addSessionItem,
  createCoachSession,
  emptyDraft,
  fetchCoachSessions,
  ownSessions,
  type ItemKind,
} from "@/lib/coach-sessions";
import { fetchMyMemberships } from "@/lib/teams";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

type Target = "session" | "event";

/**
 * En enda knapp för att lägga bankinnehåll antingen i en av mina träningar
 * eller direkt på en aktivitet i lagets kalender.
 */
export function AddToTrainingButton({
  kind,
  resourceId,
  title,
  defaultMinutes = 10,
  size = "default",
}: {
  kind: PlanKind & ItemKind;
  resourceId: string;
  title: string;
  defaultMinutes?: number;
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [target, setTarget] = useState<Target>("session");
  const [sessionId, setSessionId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [eventId, setEventId] = useState("");
  const [minutes, setMinutes] = useState(String(defaultMinutes));
  const [note, setNote] = useState("");

  const sessions = useQuery({
    queryKey: ["coach-sessions"],
    queryFn: fetchCoachSessions,
    enabled: open,
  });
  const events = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: () => fetchUpcomingEvents(),
    enabled: open,
  });
  const memberships = useQuery({
    queryKey: ["my-memberships"],
    queryFn: fetchMyMemberships,
    enabled: open,
  });

  const myList = useMemo(
    () => ownSessions(sessions.data ?? [], user?.id ?? null),
    [sessions.data, user?.id],
  );

  const coachTeams = useMemo(
    () =>
      new Set(
        (memberships.data ?? [])
          .filter((item) => item.role === "coach" && item.status === "approved")
          .map((item) => item.team_id),
      ),
    [memberships.data],
  );

  const eventOptions = useMemo(
    () => (events.data ?? []).filter((event) => coachTeams.has(event.team_id)),
    [events.data, coachTeams],
  );

  const selectedEvent = eventOptions.find((event) => event.id === eventId) ?? eventOptions[0];
  const creatingNew = sessionId === "new" || (!sessions.isLoading && myList.length === 0);

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Du måste vara inloggad.");

      if (target === "event") {
        if (!selectedEvent) throw new Error("Välj en träning eller match först.");
        await addResourceToEvent({
          eventId: selectedEvent.id,
          teamId: selectedEvent.team_id,
          userId: user.id,
          kind,
          resourceId,
          minutes: Number(minutes) || null,
          note,
        });
        return;
      }

      let id = sessionId;
      if (creatingNew || !id) {
        const name = newTitle.trim();
        if (!name) throw new Error("Ange en titel för den nya träningen.");
        id = await createCoachSession({ ...emptyDraft, title: name }, user.id);
      }
      await addSessionItem(id, user.id, {
        kind,
        title,
        resource_id: resourceId,
        minutes: Number(minutes) || defaultMinutes,
        note: note.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["coach-session-items"] });
      queryClient.invalidateQueries({ queryKey: ["event-resources"] });
      setOpen(false);
      setNote("");
      setNewTitle("");
      toast.success(
        target === "event"
          ? "Innehållet lades till i aktivitetens plan."
          : "Innehållet lades till i träningen.",
      );
    },
    onError: (error: Error) =>
      toast.error(error.message || "Det gick inte att lägga till innehållet."),
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
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lägg till i träning</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{title}</p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={target === "session"}
                onClick={() => setTarget("session")}
                className={`rounded-lg border p-3 text-left text-sm ${
                  target === "session" ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <span className="block font-semibold">Ett av mina träningspass</span>
                <span className="block text-xs text-muted-foreground">
                  Bygg ihop hela träningen
                </span>
              </button>
              <button
                type="button"
                aria-pressed={target === "event"}
                onClick={() => setTarget("event")}
                className={`rounded-lg border p-3 text-left text-sm ${
                  target === "event" ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <span className="block font-semibold">Direkt på en aktivitet</span>
                <span className="block text-xs text-muted-foreground">
                  Träning eller match i kalendern
                </span>
              </button>
            </div>

            {target === "session" &&
              (sessions.isLoading ? (
                <p className="text-sm text-muted-foreground">Laddar dina träningspass…</p>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="add-session">Träningspass</Label>
                    <select
                      id="add-session"
                      className={selectClass}
                      value={creatingNew ? "new" : sessionId}
                      onChange={(event) => setSessionId(event.target.value)}
                    >
                      {myList.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.title}
                        </option>
                      ))}
                      <option value="new">Skapa nytt träningspass…</option>
                    </select>
                  </div>

                  {creatingNew && (
                    <div className="space-y-1">
                      <Label htmlFor="add-session-title">Titel på nytt träningspass</Label>
                      <Input
                        id="add-session-title"
                        value={newTitle}
                        placeholder="T.ex. Tisdagsträning press"
                        onChange={(event) => setNewTitle(event.target.value)}
                      />
                    </div>
                  )}
                </>
              ))}

            {target === "event" &&
              (events.isLoading || memberships.isLoading ? (
                <p className="text-sm text-muted-foreground">Hämtar kommande aktiviteter…</p>
              ) : eventOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Det finns inga kommande träningar eller matcher i dina lag. Lägg först in en
                  aktivitet i lagets kalender.
                </p>
              ) : (
                <div className="space-y-1">
                  <Label htmlFor="plan-event">Träning eller match</Label>
                  <select
                    id="plan-event"
                    className={selectClass}
                    value={selectedEvent?.id ?? ""}
                    onChange={(event) => setEventId(event.target.value)}
                  >
                    {eventOptions.map((event) => (
                      <option key={event.id} value={event.id}>
                        {eventOptionLabel(event)}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

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

            <Button
              className="w-full"
              disabled={add.isPending || (target === "event" && eventOptions.length === 0)}
              onClick={() => add.mutate()}
            >
              {add.isPending ? "Lägger till…" : "Lägg till"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
