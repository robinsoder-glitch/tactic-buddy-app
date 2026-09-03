import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addObservation,
  createFocusArea,
  deleteFocusArea,
  deleteObservation,
  fetchFocusAreas,
  fetchObservations,
  FOCUS_STATUS_LABELS,
  MAX_ACTIVE_FOCUS,
  setFocusStatus,
  type FocusStatus,
} from "@/lib/period-plan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Privat utvecklingsvy för en spelare. Bara lagets ledare kommer åt den:
 * fokusområden (högst tre aktiva) och korta observationer i barnvänligt språk.
 */
export function PlayerDevelopment({
  teamId,
  playerId,
  canEdit,
}: {
  teamId: string;
  playerId: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [focusForNote, setFocusForNote] = useState<string>("");

  const focus = useQuery({
    queryKey: ["focus-areas", teamId, playerId],
    queryFn: () => fetchFocusAreas(teamId, playerId),
  });
  const observations = useQuery({
    queryKey: ["observations", teamId, playerId],
    queryFn: () => fetchObservations(teamId, playerId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["focus-areas", teamId, playerId] });
    queryClient.invalidateQueries({ queryKey: ["focus-areas", teamId] });
    queryClient.invalidateQueries({ queryKey: ["observations", teamId, playerId] });
    queryClient.invalidateQueries({ queryKey: ["observations", teamId] });
  };

  const addFocus = useMutation({
    mutationFn: () => createFocusArea({ teamId, playerId, title }),
    onSuccess: () => {
      setTitle("");
      invalidate();
      toast.success("Fokusområdet är sparat");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FocusStatus }) => setFocusStatus(id, status),
    onSuccess: invalidate,
    onError: () => toast.error("Statusen kunde inte ändras."),
  });

  const removeFocus = useMutation({
    mutationFn: (id: string) => deleteFocusArea(id),
    onSuccess: invalidate,
    onError: () => toast.error("Fokusområdet kunde inte tas bort."),
  });

  const saveObservation = useMutation({
    mutationFn: () => addObservation({ teamId, playerId, note, focusAreaId: focusForNote || null }),
    onSuccess: () => {
      setNote("");
      invalidate();
      toast.success("Observationen är sparad");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeObservation = useMutation({
    mutationFn: (id: string) => deleteObservation(id),
    onSuccess: invalidate,
    onError: () => toast.error("Observationen kunde inte tas bort."),
  });

  if (!canEdit) return null;

  const areas = focus.data ?? [];
  const activeCount = areas.filter((area) => area.status === "active").length;

  return (
    <section className="mt-6 space-y-4 rounded-xl border border-border bg-card p-4">
      <header>
        <h2 className="font-display text-lg font-semibold">Utveckling</h2>
        <p className="text-sm text-muted-foreground">
          Privat för lagets ledare. Inga betyg och inga jämförelser mellan barn – bara vad spelaren
          tränar på just nu.
        </p>
      </header>

      <div className="space-y-2">
        <Label htmlFor="focus-title">
          Nytt fokusområde ({activeCount} av {MAX_ACTIVE_FOCUS} aktiva)
        </Label>
        <div className="flex gap-2">
          <Input
            id="focus-title"
            value={title}
            placeholder="Till exempel våga vända med bollen"
            onChange={(event) => setTitle(event.target.value)}
          />
          <Button onClick={() => addFocus.mutate()} disabled={addFocus.isPending || !title.trim()}>
            <Plus className="mr-2 size-4" /> Lägg till
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {areas.map((area) => (
          <li key={area.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{area.title}</span>
              <div className="flex items-center gap-1">
                {(["active", "achieved", "paused"] as FocusStatus[]).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={area.status === status ? "default" : "outline"}
                    onClick={() => changeStatus.mutate({ id: area.id, status })}
                  >
                    {FOCUS_STATUS_LABELS[status]}
                  </Button>
                ))}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Ta bort fokusområdet ${area.title}`}
                  onClick={() => removeFocus.mutate(area.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          </li>
        ))}
        {areas.length === 0 && (
          <li className="text-sm text-muted-foreground">Inget fokusområde ännu.</li>
        )}
      </ul>

      <div className="space-y-2">
        <Label htmlFor="observation">Ny observation</Label>
        <Textarea
          id="observation"
          rows={3}
          value={note}
          placeholder="Kort och konkret: vad såg du på träningen?"
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Koppla observationen till ett fokusområde"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={focusForNote}
            onChange={(event) => setFocusForNote(event.target.value)}
          >
            <option value="">Utan fokusområde</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.title}
              </option>
            ))}
          </select>
          <Button
            onClick={() => saveObservation.mutate()}
            disabled={saveObservation.isPending || !note.trim()}
          >
            Spara observation
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {(observations.data ?? []).map((observation) => (
          <li
            key={observation.id}
            className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
          >
            <div>
              <p className="text-sm">{observation.note}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(observation.created_at).toLocaleDateString("sv-SE")}
                {observation.focus_area_id
                  ? ` · ${areas.find((area) => area.id === observation.focus_area_id)?.title ?? "Fokusområde"}`
                  : ""}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Ta bort observationen"
              onClick={() => removeObservation.mutate(observation.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
        {(observations.data ?? []).length === 0 && (
          <li className="text-sm text-muted-foreground">Inga observationer ännu.</li>
        )}
      </ul>
    </section>
  );
}
