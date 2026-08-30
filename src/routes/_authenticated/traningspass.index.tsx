import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createCoachSession,
  deleteCoachSession,
  duplicateCoachSession,
  emptyDraft,
  fetchAllSessionItems,
  fetchCoachSessions,
  totalMinutes,
  SESSION_STATUS_LABELS,
  type SessionDraft,
} from "@/lib/coach-sessions";
import { useAuth } from "@/hooks/useAuth";
import { useConfirm } from "@/components/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/traningspass/")({
  head: () => ({
    meta: [
      { title: "Mina träningar – planera träningen" },
      {
        name: "description",
        content:
          "Skapa egna träningspass av taktiker, övningar, målvaktsövningar och kunskapsartiklar. Planera tid, ordning och anteckningar.",
      },
      { property: "og:title", content: "Mina träningar" },
      { property: "og:description", content: "Bygg ditt eget träningspass av innehållet i bankerna." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MySessionsPage,
});

function MySessionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);

  const sessions = useQuery({ queryKey: ["coach-sessions"], queryFn: fetchCoachSessions });
  const items = useQuery({ queryKey: ["coach-session-items"], queryFn: fetchAllSessionItems });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const session = (sessions.data ?? []).find((item) => item.id === id);
      if (!session || !user) throw new Error("Träningspasset kunde inte kopieras.");
      return duplicateCoachSession(session, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["coach-session-items"] });
      toast.success("Kopia skapad");
    },
    onError: () => toast.error("Det gick inte att kopiera träningspasset."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCoachSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["coach-session-items"] });
      toast.success("Träningspasset raderades");
    },
    onError: () => toast.error("Det gick inte att radera träningspasset."),
  });

  const list = sessions.data ?? [];
  const allItems = items.data ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 pb-32 pt-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka till Träningsbanken">
          <Link to="/ovningsbank">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <p className="font-display text-xs tracking-[0.3em] text-primary">Planera träningen</p>
          <h1 className="font-display text-3xl font-bold">Mina träningar</h1>
        </div>
        <Button onClick={() => setCreateOpen(true)} aria-label="Skapa träningspass">
          <Plus className="size-4" /> Skapa träningspass
        </Button>
      </header>

      {sessions.isLoading && <p className="mt-6 text-sm text-muted-foreground">Laddar dina träningspass…</p>}

      {sessions.isError && (
        <p className="mt-6 text-sm text-muted-foreground">
          Det gick inte att hämta dina träningspass just nu. Försök igen om en stund.
        </p>
      )}

      {!sessions.isLoading && !sessions.isError && list.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center">
          <ListChecks className="mx-auto size-8 text-primary" />
          <p className="mt-3 font-display text-lg font-semibold">Du har inte skapat något träningspass ännu.</p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Skapa ditt första träningspass
          </Button>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {list.map((session) => {
          const own = allItems.filter((item) => item.session_id === session.id);
          return (
            <article key={session.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold">{session.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {session.session_date ? `Datum: ${session.session_date} · ` : ""}
                    Total planerad tid: {totalMinutes(own)} minuter · {own.length} delar
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Senast ändrad: {new Date(session.updated_at).toLocaleDateString("sv-SE")}
                  </p>
                </div>
                <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                  Status: {SESSION_STATUS_LABELS[session.status] ?? "Utkast"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/traningspass/$id/visa" params={{ id: session.id }} aria-label={`Öppna ${session.title}`}>
                    Öppna
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/traningspass/$id" params={{ id: session.id }} aria-label={`Redigera ${session.title}`}>
                    <Pencil className="size-4" /> Redigera
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Duplicera ${session.title}`}
                  disabled={duplicate.isPending}
                  onClick={() => duplicate.mutate(session.id)}
                >
                  <Copy className="size-4" /> Duplicera
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Radera ${session.title}`}
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Radera träningspass",
                      description: "Vill du radera träningspasset? Det går inte att ångra.",
                      confirmLabel: "Radera",
                    });
                    if (ok) remove.mutate(session.id);
                  }}
                >
                  <Trash2 className="size-4" /> Radera
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <CreateSessionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => {
          setCreateOpen(false);
          navigate({ to: "/traningspass/$id", params: { id } });
        }}
      />
      {confirmDialog}
    </main>
  );
}

function CreateSessionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const [draft, setDraft] = useState<SessionDraft>(emptyDraft);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Du måste vara inloggad.");
      if (!draft.title.trim()) throw new Error("Ange en titel för träningspasset.");
      return createCoachSession(draft, user.id);
    },
    onSuccess: (id) => {
      setDraft(emptyDraft);
      setError(null);
      toast.success("Träningspasset sparades som utkast");
      onCreated(id);
    },
    onError: (err: Error) => setError(err.message || "Det gick inte att spara träningspasset."),
  });

  const set = (patch: Partial<SessionDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skapa träningspass</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="new-title">Titel (obligatorisk)</Label>
            <Input
              id="new-title"
              value={draft.title}
              placeholder="T.ex. Tisdagsträning – press"
              onChange={(event) => set({ title: event.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="new-date">Datum (frivilligt)</Label>
              <Input
                id="new-date"
                type="date"
                value={draft.session_date ?? ""}
                onChange={(event) => set({ session_date: event.target.value || null })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-age">Åldersgrupp</Label>
              <Input
                id="new-age"
                value={draft.age_group ?? ""}
                placeholder="T.ex. 8–9 år"
                onChange={(event) => set({ age_group: event.target.value || null })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-format">Spelform</Label>
            <Input
              id="new-format"
              value={draft.game_format ?? ""}
              placeholder="T.ex. 5 mot 5"
              onChange={(event) => set({ game_format: event.target.value || null })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-theme">Träningens tema</Label>
            <Input
              id="new-theme"
              value={draft.theme ?? ""}
              placeholder="T.ex. Press och återerövring"
              onChange={(event) => set({ theme: event.target.value || null })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-goal">Målsättning</Label>
            <Textarea
              id="new-goal"
              rows={2}
              value={draft.goal ?? ""}
              placeholder="Vad ska spelarna kunna efter passet?"
              onChange={(event) => set({ goal: event.target.value || null })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="new-notes">Tränarens anteckningar</Label>
            <Textarea
              id="new-notes"
              rows={3}
              value={draft.notes ?? ""}
              placeholder="Material, indelning av grupper och annat att komma ihåg."
              onChange={(event) => set({ notes: event.target.value || null })}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Sparar…" : "Spara som utkast"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
