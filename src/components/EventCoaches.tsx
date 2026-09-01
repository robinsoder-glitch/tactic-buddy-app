import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addEventCoach, coachLabel, fetchEventCoaches, removeEventCoach } from "@/lib/event-coaches";
import { fetchTeamMembers } from "@/lib/teams";

type Props = {
  eventId: string;
  teamId: string;
  userId: string | null;
  canEdit: boolean;
};

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Ansvariga tränare för en träning eller match. */
export function EventCoaches({ eventId, teamId, userId, canEdit }: Props) {
  const queryClient = useQueryClient();
  const [pick, setPick] = useState("");
  const [note, setNote] = useState("");

  const coaches = useQuery({ queryKey: ["event-coaches", eventId], queryFn: () => fetchEventCoaches([eventId]) });
  const members = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: () => fetchTeamMembers(teamId),
    enabled: canEdit,
  });

  const coachOptions = (members.data ?? []).filter(
    (member) =>
      member.role === "coach" &&
      member.status === "approved" &&
      !(coaches.data ?? []).some((row) => row.user_id === member.user_id),
  );

  const add = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Du måste vara inloggad.");
      const chosen = pick || coachOptions[0]?.user_id;
      if (!chosen) throw new Error("Välj en tränare.");
      await addEventCoach({ eventId, teamId, userId: chosen, createdBy: userId, note });
    },
    onSuccess: () => {
      setPick("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["event-coaches"] });
      toast.success("Ansvarig tränare tillagd.");
    },
    onError: () => toast.error("Det gick inte att lägga till tränaren."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeEventCoach(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-coaches"] });
      toast.success("Tränaren togs bort.");
    },
    onError: () => toast.error("Det gick inte att ta bort tränaren."),
  });

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-display text-lg font-semibold">Ansvariga tränare</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Ange vem som leder aktiviteten. Alla i laget ser vem de kan vända sig till.
      </p>

      {coaches.isLoading && <p className="mt-3 text-sm text-muted-foreground">Hämtar ansvariga…</p>}
      <ul className="mt-3 space-y-2">
        {!coaches.isLoading && (coaches.data ?? []).length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
            Ingen ansvarig tränare är utsedd ännu.
          </li>
        )}
        {(coaches.data ?? []).map((coach) => (
          <li
            key={coach.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate">{coachLabel(coach)}</span>
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Ta bort ${coach.displayName ?? "tränare"} som ansvarig`}
                onClick={() => remove.mutate(coach.id)}
                disabled={remove.isPending}
              >
                <Trash2 className="size-4 text-destructive" />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {canEdit && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor={`coach-${eventId}`}>Tränare</Label>
            <select
              id={`coach-${eventId}`}
              className={selectClass}
              value={pick || coachOptions[0]?.user_id || ""}
              onChange={(event) => setPick(event.target.value)}
              disabled={coachOptions.length === 0}
            >
              {coachOptions.length === 0 && <option value="">Inga fler tränare i laget</option>}
              {coachOptions.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.displayName?.trim() || "Tränare"}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`coach-note-${eventId}`}>Ansvarar för (frivilligt)</Label>
            <Input
              id={`coach-note-${eventId}`}
              value={note}
              placeholder="T.ex. uppvärmning"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <Button onClick={() => add.mutate()} disabled={add.isPending || coachOptions.length === 0}>
            <UserPlus className="size-4" /> Lägg till
          </Button>
        </div>
      )}
    </section>
  );
}
