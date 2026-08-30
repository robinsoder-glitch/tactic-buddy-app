import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  addSessionItem,
  deleteSessionItem,
  fetchCoachSession,
  fetchSessionItems,
  ITEM_KINDS,
  ITEM_KIND_LABELS,
  minutesLabel,
  moveItem,
  saveItemOrder,
  SESSION_STATUS_LABELS,
  totalMinutes,
  updateCoachSession,
  updateSessionItem,
  type CoachSessionItem,
  type ItemKind,
  type SessionDraft,
} from "@/lib/coach-sessions";

import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/components/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/traningspass/$id/")({
  head: () => ({
    meta: [
      { title: "Bygg träningspass – Mina träningspass" },
      {
        name: "description",
        content: "Sätt ihop ditt träningspass: lägg till delar, ändra ordning, sätt tid och skriv anteckningar.",
      },
      { property: "og:title", content: "Bygg träningspass" },
      { property: "og:description", content: "Planera innehåll, ordning och tid för ditt träningspass." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SessionBuilder,
});

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function SessionBuilder() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();

  const session = useQuery({ queryKey: ["coach-session", id], queryFn: () => fetchCoachSession(id) });
  const itemsQuery = useQuery({ queryKey: ["coach-session-items", id], queryFn: () => fetchSessionItems(id) });

  const [items, setItems] = useState<CoachSessionItem[]>([]);
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (itemsQuery.data) setItems(itemsQuery.data);
  }, [itemsQuery.data]);

  useEffect(() => {
    if (session.data && !draft) {
      const { title, session_date, age_group, game_format, theme, goal, notes } = session.data;
      setDraft({ title, session_date, age_group, game_format, theme, goal, notes });
    }
  }, [session.data, draft]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["coach-session-items", id] });
    queryClient.invalidateQueries({ queryKey: ["coach-session-items"] });
    queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
  };

  const saveInfo = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      if (!draft.title.trim()) throw new Error("Ange en titel för träningspasset.");
      await updateCoachSession(id, draft);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-session", id] });
      queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      toast.success("Träningspasset sparades");
    },
    onError: (error: Error) => toast.error(error.message || "Det gick inte att spara träningspasset."),
  });

  const setStatus = useMutation({
    mutationFn: (status: string) => updateCoachSession(id, { status }),
    onSuccess: (_data, status) => {
      queryClient.invalidateQueries({ queryKey: ["coach-session", id] });
      queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      toast.success(
        status === "done" ? "Träningspasset är markerat som genomfört" : "Träningspasset är markerat som utkast",
      );
    },
    onError: () => toast.error("Det gick inte att ändra status."),
  });

  const saveOrder = useMutation({
    mutationFn: (next: CoachSessionItem[]) => saveItemOrder(next),
    onSuccess: invalidate,
    onError: () => toast.error("Det gick inte att spara ordningen."),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => deleteSessionItem(itemId),
    onSuccess: () => {
      invalidate();
      toast.success("Delen togs bort");
    },
    onError: () => toast.error("Det gick inte att ta bort delen."),
  });

  const patchItem = useMutation({
    mutationFn: ({ itemId, patch }: { itemId: string; patch: Partial<CoachSessionItem> }) =>
      updateSessionItem(itemId, patch),
    onSuccess: invalidate,
    onError: () => toast.error("Det gick inte att spara ändringen."),
  });

  if (session.isLoading) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Laddar träningspasset…</main>;
  }

  if (!session.data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Träningspasset kunde inte hittas.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/traningspass">Tillbaka till Mina träningspass</Link>
        </Button>
      </main>
    );
  }

  const set = (patch: Partial<SessionDraft>) => setDraft((prev) => (prev ? { ...prev, ...patch } : prev));

  function reorder(index: number, direction: -1 | 1) {
    const next = moveItem(items, index, direction);
    setItems(next);
    saveOrder.mutate(next);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka till Mina träningspass">
          <Link to="/traningspass">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <p className="font-display text-xs uppercase tracking-[0.3em] text-primary">Bygg träningspass</p>
          <h1 className="font-display text-2xl font-bold uppercase">{session.data.title}</h1>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/traningspass/$id/visa" params={{ id }} aria-label="Visa träningspass">
            Visa träningspass
          </Link>
        </Button>

      </header>

      <section className="mt-5 space-y-3 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Information</h2>
        {draft && (
          <>
            <div className="space-y-1">
              <Label htmlFor="edit-title">Titel</Label>
              <Input id="edit-title" value={draft.title} onChange={(event) => set({ title: event.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-date">Datum</Label>
                <Input
                  id="edit-date"
                  type="date"
                  value={draft.session_date ?? ""}
                  onChange={(event) => set({ session_date: event.target.value || null })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-age">Åldersgrupp</Label>
                <Input
                  id="edit-age"
                  value={draft.age_group ?? ""}
                  onChange={(event) => set({ age_group: event.target.value || null })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="edit-format">Spelform</Label>
                <Input
                  id="edit-format"
                  value={draft.game_format ?? ""}
                  onChange={(event) => set({ game_format: event.target.value || null })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-theme">Tema</Label>
                <Input
                  id="edit-theme"
                  value={draft.theme ?? ""}
                  onChange={(event) => set({ theme: event.target.value || null })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-goal">Målsättning</Label>
              <Textarea
                id="edit-goal"
                rows={2}
                value={draft.goal ?? ""}
                onChange={(event) => set({ goal: event.target.value || null })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-notes">Tränarens anteckningar</Label>
              <Textarea
                id="edit-notes"
                rows={3}
                value={draft.notes ?? ""}
                onChange={(event) => set({ notes: event.target.value || null })}
              />
            </div>
            <Button disabled={saveInfo.isPending} onClick={() => saveInfo.mutate()}>
              <Save className="size-4" /> {saveInfo.isPending ? "Sparar…" : "Spara information"}
            </Button>
          </>
        )}
      </section>

      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">
            Innehåll <span className="text-sm font-normal text-muted-foreground">({minutesLabel(totalMinutes(items))})</span>
          </h2>
          <Button size="sm" onClick={() => setAddOpen(true)} aria-label="Lägg till del">
            <Plus className="size-4" /> Lägg till del
          </Button>
        </div>

        {items.length === 0 && (
          <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Träningspasset är tomt. Lägg till samling, övningar och avslutning – eller lägg till innehåll direkt från
            Taktikbanken, Övningsbanken och Kunskapsbanken.
          </p>
        )}

        <ol className="mt-3 space-y-3">
          {items.map((item, index) => (
            <li key={item.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {index + 1}. {ITEM_KIND_LABELS[item.kind as ItemKind] ?? "Egen aktivitet"}
                  </p>
                  <p className="font-display text-base font-semibold">{item.title}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Flytta upp"
                    disabled={index === 0}
                    onClick={() => reorder(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Flytta ner"
                    disabled={index === items.length - 1}
                    onClick={() => reorder(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Ta bort del"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Ta bort del",
                        description: `Vill du ta bort "${item.title}" ur träningspasset?`,
                        confirmLabel: "Ta bort",
                      });
                      if (ok) removeItem.mutate(item.id);
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr]">
                <div className="space-y-1">
                  <Label htmlFor={`minutes-${item.id}`}>Minuter</Label>
                  <Input
                    id={`minutes-${item.id}`}
                    type="number"
                    min={0}
                    max={180}
                    value={item.minutes}
                    onChange={(event) => {
                      const minutes = Number(event.target.value) || 0;
                      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, minutes } : row)));
                    }}
                    onBlur={() => patchItem.mutate({ itemId: item.id, patch: { minutes: item.minutes } })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`note-${item.id}`}>Anteckning</Label>
                  <Input
                    id={`note-${item.id}`}
                    value={item.note ?? ""}
                    placeholder="Coachpunkter, material eller organisation"
                    onChange={(event) => {
                      const note = event.target.value;
                      setItems((prev) => prev.map((row) => (row.id === item.id ? { ...row, note } : row)));
                    }}
                    onBlur={() => patchItem.mutate({ itemId: item.id, patch: { note: item.note } })}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <AddItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdd={async (item) => {
          if (!user) return;
          await addSessionItem(id, user.id, item);
          invalidate();
          setAddOpen(false);
          toast.success("Delen lades till");
        }}
      />
      {confirmDialog}
    </main>
  );
}

function AddItemDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onAdd: (item: { kind: ItemKind; title: string; minutes: number; note: string | null }) => Promise<void>;
}) {
  const [kind, setKind] = useState<ItemKind>("gathering");
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("10");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lägg till del</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="item-kind">Typ av del</Label>
            <select
              id="item-kind"
              className={selectClass}
              value={kind}
              onChange={(event) => setKind(event.target.value as ItemKind)}
            >
              {ITEM_KINDS.map((value) => (
                <option key={value} value={value}>
                  {ITEM_KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-title">Rubrik</Label>
            <Input
              id="item-title"
              value={title}
              placeholder="T.ex. Samling och genomgång"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-minutes">Minuter</Label>
            <Input
              id="item-minutes"
              type="number"
              min={0}
              max={180}
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="item-note">Anteckning</Label>
            <Input id="item-note" value={note} onChange={(event) => setNote(event.target.value)} />
          </div>

          <p className="text-xs text-muted-foreground">
            Innehåll från Taktikbanken, Övningsbanken och Kunskapsbanken lägger du till med knappen &quot;Lägg till i
            träningspass&quot; på respektive kort.
          </p>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            disabled={saving}
            onClick={async () => {
              if (!title.trim()) {
                setError("Ange en rubrik för delen.");
                return;
              }
              setError(null);
              setSaving(true);
              try {
                await onAdd({
                  kind,
                  title: title.trim(),
                  minutes: Number(minutes) || 0,
                  note: note.trim() || null,
                });
                setTitle("");
                setNote("");
              } catch {
                setError("Det gick inte att lägga till delen. Försök igen.");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Lägger till…" : "Lägg till"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
