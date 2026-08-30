import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { deleteEvent, fetchEvents, formatDateTime, saveEvent, type TeamEvent } from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { EventResources } from "@/components/EventResources";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  teamId: string;
  userId: string | null;
  isCoach: boolean;
  type: "training" | "match";
  title: string;
};

export function EventManager({ teamId, userId, isCoach, type, title }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamEvent | null>(null);
  const [heading, setHeading] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const events = useQuery({
    queryKey: ["events", teamId, type],
    queryFn: () => fetchEvents(teamId, type),
  });

  function openNew() {
    setEditing(null);
    setHeading("");
    setStartsAt("");
    setLocation("");
    setNotes("");
    setOpen(true);
  }

  function openEdit(event: TeamEvent) {
    setEditing(event);
    setHeading(event.title ?? "");
    setStartsAt(event.starts_at.slice(0, 16));
    setLocation(event.location ?? "");
    setNotes(event.notes ?? "");
    setOpen(true);
  }

  async function save() {
    if (!userId) return;
    if (!startsAt) {
      toast.error("Ange datum och tid");
      return;
    }
    setBusy(true);
    try {
      await saveEvent({
        id: editing?.id,
        teamId,
        userId,
        type,
        title: heading.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        location: location.trim() || null,
        notes: notes.trim() || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["events", teamId] });
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara");
    } finally {
      setBusy(false);
    }
  }

  const remove = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events", teamId] }),
  });

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold uppercase">{title}</h2>
        {isCoach && (
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" /> Nytt
          </Button>
        )}
      </div>

      <ul className="mt-4 space-y-3">
        {events.data?.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Inget inplanerat än.
          </li>
        )}
        {events.data?.map((event) => (
          <li key={event.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => isCoach && openEdit(event)}>
                <p className="font-display text-lg font-semibold">
                  {event.title ?? (type === "training" ? "Träning" : "Match")}
                </p>
                <p className="text-sm text-primary">{formatDateTime(event.starts_at)}</p>
                {event.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {event.location}
                  </p>
                )}
                {event.notes && <p className="mt-2 text-sm text-muted-foreground">{event.notes}</p>}
              </button>
              {isCoach && (
                <Button size="icon" variant="ghost" onClick={() => remove.mutate(event.id)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
            {type === "training" && (
              <EventResources eventId={event.id} teamId={teamId} userId={userId} isCoach={isCoach} />
            )}
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{type === "training" ? "Träningstillfälle" : "Match"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="e-title">Rubrik</Label>
              <Input
                id="e-title"
                placeholder={type === "training" ? "T.ex. Passningsträning" : "T.ex. Hemma mot IFK"}
                value={heading}
                onChange={(event) => setHeading(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-time">Tid</Label>
              <Input
                id="e-time"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-place">Plats</Label>
              <Input id="e-place" value={location} onChange={(event) => setLocation(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="e-notes">Övrigt</Label>
              <Textarea
                id="e-notes"
                rows={3}
                placeholder="Ta med regnkläder, träningen är extra kort…"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={busy}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
