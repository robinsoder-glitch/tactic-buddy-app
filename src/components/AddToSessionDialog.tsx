import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import {
  addSessionItem,
  createCoachSession,
  emptyDraft,
  fetchCoachSessions,
  type ItemKind,
} from "@/lib/coach-sessions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

/** Knapp som lägger till innehåll från en bank i ett personligt träningspass. */
export function AddToSessionButton({
  kind,
  resourceId,
  title,
  defaultMinutes = 10,
  size = "default",
}: {
  kind: ItemKind;
  resourceId: string;
  title: string;
  defaultMinutes?: number;
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const sessions = useQuery({ queryKey: ["coach-sessions"], queryFn: fetchCoachSessions, enabled: open });
  const [target, setTarget] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [minutes, setMinutes] = useState(String(defaultMinutes));
  const [note, setNote] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Du måste vara inloggad.");
      let sessionId = target;
      if (target === "new" || !target) {
        const name = newTitle.trim();
        if (!name) throw new Error("Ange en titel för det nya träningspasset.");
        sessionId = await createCoachSession({ ...emptyDraft, title: name }, user.id);
      }
      await addSessionItem(sessionId, user.id, {
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
      setOpen(false);
      setNote("");
      setNewTitle("");
      toast.success("Tillagt i träningspasset.");
    },
    onError: (error: Error) => toast.error(error.message || "Det gick inte att lägga till innehållet."),
  });

  const list = sessions.data ?? [];
  const creatingNew = target === "new" || (!sessions.isLoading && list.length === 0);

  return (
    <>
      <Button
        variant="outline"
        size={size}
        aria-label={`Lägg till ${title} i träningspass`}
        onClick={() => setOpen(true)}
      >
        <CalendarPlus className="size-4" /> Lägg till i träningspass
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lägg till i träningspass</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{title}</p>

            {sessions.isLoading ? (
              <p className="text-sm text-muted-foreground">Laddar dina träningspass…</p>
            ) : (
              <div className="space-y-1">
                <Label htmlFor="add-session">Träningspass</Label>
                <select
                  id="add-session"
                  className={selectClass}
                  value={creatingNew ? "new" : target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  {list.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title}
                    </option>
                  ))}
                  <option value="new">Skapa nytt träningspass…</option>
                </select>
              </div>
            )}

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

            <div className="space-y-1">
              <Label htmlFor="add-session-minutes">Planerad tid (minuter)</Label>
              <Input
                id="add-session-minutes"
                type="number"
                min={0}
                max={180}
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="add-session-note">Anteckning (valfritt)</Label>
              <Input
                id="add-session-note"
                value={note}
                placeholder="T.ex. Kör två omgångar"
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <Button className="w-full" disabled={add.isPending} onClick={() => add.mutate()}>
              {add.isPending ? "Lägger till…" : "Lägg till"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
