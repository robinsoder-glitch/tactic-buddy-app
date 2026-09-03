import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  hasErrors,
  splitLocal,
  toIso,
  validateEventTimes,
  type EventTimeErrors,
} from "@/lib/event-datetime";
import { changeReceipt, diffEvent, logEventChange } from "@/lib/event-changes";
import type { TeamEvent } from "@/lib/teams";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: TeamEvent;
};

/**
 * Ändra aktivitet: jämför före och efter, sparar atomiskt,
 * loggar ändringen och skickar en intern notis till berörda.
 */
export function EventEditDialog({ open, onOpenChange, event }: Props) {
  const queryClient = useQueryClient();
  const start = splitLocal(event.starts_at);
  const [date, setDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [endTime, setEndTime] = useState(splitLocal(event.ends_at).time);
  const [meetTime, setMeetTime] = useState(splitLocal(event.meet_at).time);
  const [location, setLocation] = useState(event.location ?? "");
  const [errors, setErrors] = useState<EventTimeErrors>({});

  useEffect(() => {
    if (!open) return;
    const next = splitLocal(event.starts_at);
    setDate(next.date);
    setStartTime(next.time);
    setEndTime(splitLocal(event.ends_at).time);
    setMeetTime(splitLocal(event.meet_at).time);
    setLocation(event.location ?? "");
    setErrors({});
  }, [open, event.starts_at, event.ends_at, event.meet_at, event.location]);

  const save = useMutation({
    mutationFn: async () => {
      const found = validateEventTimes({
        date,
        start: startTime,
        end: endTime,
        meet: meetTime,
      });
      setErrors(found);
      if (hasErrors(found)) throw new Error("VALIDATION");

      const patch = {
        starts_at: toIso(date, startTime)!,
        ends_at: endTime ? toIso(date, endTime) : null,
        meet_at: meetTime ? toIso(date, meetTime) : null,
        location: location.trim() || null,
      };
      const changes = diffEvent(event, patch);
      if (changes.length === 0) return changes;

      const { error } = await supabase.from("events").update(patch).eq("id", event.id);
      if (error) throw error;
      await logEventChange(event.id, changes);
      return changes;
    },
    onSuccess: async (changes) => {
      await queryClient.invalidateQueries({ queryKey: ["event", event.id] });
      queryClient.invalidateQueries({ queryKey: ["events", event.team_id] });
      queryClient.invalidateQueries({ queryKey: ["event-change-log", event.id] });
      toast.success(changeReceipt(changes));
      onOpenChange(false);
    },
    onError: (error: Error) => {
      if (error.message === "VALIDATION") return;
      toast.error("Ändringen kunde inte sparas. Kontrollera nätet och försök igen.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ändra aktivitet</DialogTitle>
        </DialogHeader>

        <label className="text-sm">
          Datum
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {errors.date && <span className="text-xs text-destructive">{errors.date}</span>}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">
            Starttid
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            {errors.start && <span className="text-xs text-destructive">{errors.start}</span>}
          </label>
          <label className="text-sm">
            Sluttid
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            {errors.end && <span className="text-xs text-destructive">{errors.end}</span>}
          </label>
        </div>

        {event.type === "match" && (
          <label className="text-sm">
            Samlingstid
            <Input type="time" value={meetTime} onChange={(e) => setMeetTime(e.target.value)} />
            {errors.meet && <span className="text-xs text-destructive">{errors.meet}</span>}
          </label>
        )}

        <label className="text-sm">
          Plats
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Till exempel Sportfältet plan 3"
          />
        </label>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Spara ändringen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
