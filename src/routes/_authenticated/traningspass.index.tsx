import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Copy, ListChecks, Pencil, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  createCoachSession,
  createFromTemplate,
  deleteCoachSession,
  duplicateCoachSession,
  emptyDraft,
  fetchAllSessionItems,
  fetchCoachSessions,
  ownSessions,
  sharedSessions,
  totalMinutes,
  SESSION_STATUS_LABELS,
  type CoachSession,
  type SessionDraft,
} from "@/lib/coach-sessions";
import { fetchTrainingSessions } from "@/lib/taktikbank";
import { fetchSessionLinks, linkLabel } from "@/lib/event-planning";
import { useAuth } from "@/hooks/useAuth";
import { useAccount } from "@/hooks/useAccount";
import { useConfirm } from "@/components/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/traningspass/")({
  head: () => ({
    meta: [
      { title: "Mina träningar – planera hela träningen" },
      {
        name: "description",
        content:
          "Skapa hela träningen: utgå från Träningsbanken, kopiera en tidigare träning eller börja från tomt. Koppla träningen till kalendern så andra tränare kan köra den.",
      },
      { property: "og:title", content: "Mina träningar" },
      {
        property: "og:description",
        content: "Bygg träningen och koppla den till en aktivitet i lagets kalender.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MySessionsPage,
});

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function MySessionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [createOpen, setCreateOpen] = useState(false);

  const sessions = useQuery({ queryKey: ["coach-sessions"], queryFn: fetchCoachSessions });
  const items = useQuery({ queryKey: ["coach-session-items"], queryFn: fetchAllSessionItems });

  const all = useMemo(() => sessions.data ?? [], [sessions.data]);
  const mine = ownSessions(all, user?.id ?? null);
  const shared = sharedSessions(all, user?.id ?? null);

  const links = useQuery({
    queryKey: ["session-links", all.map((session) => session.id).join(",")],
    queryFn: () => fetchSessionLinks(all.map((session) => session.id)),
    enabled: all.length > 0,
  });

  const duplicate = useMutation({
    mutationFn: async (id: string) => {
      const session = all.find((item) => item.id === id);
      if (!session || !user) throw new Error("Träningen kunde inte kopieras.");
      return duplicateCoachSession(session, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["coach-session-items"] });
      toast.success("Kopia skapad");
    },
    onError: () => toast.error("Det gick inte att kopiera träningen."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteCoachSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["coach-session-items"] });
      toast.success("Träningen raderades");
    },
    onError: () => toast.error("Det gick inte att radera träningen."),
  });

  const allItems = items.data ?? [];
  const allLinks = links.data ?? [];

  const card = (session: CoachSession, editable: boolean) => {
    const own = allItems.filter((item) => item.session_id === session.id);
    const linked = allLinks.filter((link) => link.session_id === session.id);
    return (
      <article key={session.id} className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold">{session.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {session.session_date ? `Datum: ${session.session_date} · ` : ""}
              Total planerad tid: {totalMinutes(own)} minuter · {own.length} delar
            </p>
            <p className="text-xs text-muted-foreground">
              Senast ändrad: {new Date(session.updated_at).toLocaleDateString("sv-SE")}
            </p>
            {linked.length > 0 ? (
              <p className="mt-1 text-xs text-primary">
                Kopplad till kalendern: {linked.map((link) => linkLabel(link)).join(" · ")}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Inte kopplad till någon aktivitet ännu.</p>
            )}
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
          {editable && (
            <Button asChild variant="outline" size="sm">
              <Link to="/traningspass/$id" params={{ id: session.id }} aria-label={`Redigera ${session.title}`}>
                <Pencil className="size-4" /> Redigera
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            aria-label={`Kopiera ${session.title}`}
            disabled={duplicate.isPending}
            onClick={() => duplicate.mutate(session.id)}
          >
            <Copy className="size-4" /> {editable ? "Duplicera" : "Kopiera till mina"}
          </Button>
          {editable && (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Radera ${session.title}`}
              onClick={async () => {
                const ok = await confirm({
                  title: "Radera träning",
                  description: "Vill du radera träningen? Det går inte att ångra.",
                  confirmLabel: "Radera",
                });
                if (ok) remove.mutate(session.id);
              }}
            >
              <Trash2 className="size-4" /> Radera
            </Button>
          )}
        </div>
      </article>
    );
  };

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
        <Button onClick={() => setCreateOpen(true)} aria-label="Skapa träning">
          <Plus className="size-4" /> Skapa träning
        </Button>
      </header>

      <p className="mt-3 text-sm text-muted-foreground">
        Bygg hela träningen och koppla den sedan till en träning i lagets kalender. Då kan lagets övriga tränare se och
        köra passet, även om du själv inte kan vara med.
      </p>

      {sessions.isLoading && <p className="mt-6 text-sm text-muted-foreground">Laddar dina träningar…</p>}

      {sessions.isError && (
        <p className="mt-6 text-sm text-muted-foreground">
          Det gick inte att hämta dina träningar just nu. Försök igen om en stund.
        </p>
      )}

      {!sessions.isLoading && !sessions.isError && mine.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center">
          <ListChecks className="mx-auto size-8 text-primary" />
          <p className="mt-3 font-display text-lg font-semibold">Du har inte skapat någon träning ännu.</p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Skapa din första träning
          </Button>
        </div>
      )}

      <div className="mt-4 space-y-3">{mine.map((session) => card(session, true))}</div>

      {shared.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">
            <Users className="size-5 text-primary" /> Lagets träningar
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Träningar som andra tränare i dina lag har delat. Du kan köra dem eller kopiera dem till dina egna.
          </p>
          <div className="mt-3 space-y-3">{shared.map((session) => card(session, false))}</div>
        </section>
      )}

      <CreateSessionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mySessions={mine}
        onCreated={(id) => {
          setCreateOpen(false);
          queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
          queryClient.invalidateQueries({ queryKey: ["coach-session-items"] });
          navigate({ to: "/traningspass/$id", params: { id } });
        }}
      />
      {confirmDialog}
    </main>
  );
}

type StartMode = "blank" | "bank" | "mine";

function CreateSessionDialog({
  open,
  onOpenChange,
  mySessions,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  mySessions: CoachSession[];
  onCreated: (id: string) => void;
}) {
  const { user } = useAuth();
  const account = useAccount();
  const [mode, setMode] = useState<StartMode>("blank");
  const [draft, setDraft] = useState<SessionDraft>(emptyDraft);
  const [templateId, setTemplateId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ["tb-training-sessions"],
    queryFn: fetchTrainingSessions,
    enabled: open && mode === "bank",
  });

  const coachTeams = account.memberships.filter(
    (item) => item.role === "coach" && item.status === "approved",
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Du måste vara inloggad.");

      if (mode === "bank") {
        const list = templates.data ?? [];
        const template = list.find((item) => item.id === templateId) ?? list[0];
        if (!template) throw new Error("Välj ett färdigt pass i Träningsbanken.");
        return createFromTemplate(template, user.id);
      }

      if (mode === "mine") {
        const source = mySessions.find((item) => item.id === sourceId) ?? mySessions[0];
        if (!source) throw new Error("Du har ingen tidigare träning att utgå från.");
        return duplicateCoachSession(source, user.id);
      }

      if (!draft.title.trim()) throw new Error("Ange en titel för träningen.");
      return createCoachSession(draft, user.id);
    },
    onSuccess: (id) => {
      setDraft(emptyDraft);
      setError(null);
      toast.success("Träningen sparades som utkast");
      onCreated(id);
    },
    onError: (err: Error) => setError(err.message || "Det gick inte att spara träningen."),
  });

  const set = (patch: Partial<SessionDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Skapa träning</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Välj hur du vill börja.</p>

          <div className="grid gap-2 sm:grid-cols-3">
            <ModeCard
              active={mode === "bank"}
              onClick={() => setMode("bank")}
              icon={<Sparkles className="size-4 text-primary" />}
              title="Färdigt pass"
              hint="Från Träningsbanken"
            />
            <ModeCard
              active={mode === "mine"}
              onClick={() => setMode("mine")}
              icon={<Copy className="size-4 text-primary" />}
              title="Tidigare träning"
              hint="Kopiera en av mina"
            />
            <ModeCard
              active={mode === "blank"}
              onClick={() => setMode("blank")}
              icon={<BookOpen className="size-4 text-primary" />}
              title="Från start"
              hint="Tomt upplägg"
            />
          </div>

          {mode === "bank" && (
            <div className="space-y-1">
              <Label htmlFor="template-select">Färdigt pass</Label>
              {templates.isLoading ? (
                <p className="text-sm text-muted-foreground">Hämtar färdiga pass…</p>
              ) : (templates.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Det finns inga färdiga pass i Träningsbanken ännu.</p>
              ) : (
                <select
                  id="template-select"
                  className={selectClass}
                  value={templateId || (templates.data ?? [])[0]?.id || ""}
                  onChange={(event) => setTemplateId(event.target.value)}
                >
                  {(templates.data ?? []).map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.title}
                      {template.total_minutes ? ` · ${template.total_minutes} min` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {mode === "mine" && (
            <div className="space-y-1">
              <Label htmlFor="source-select">Tidigare träning</Label>
              {mySessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Du har ingen tidigare träning att utgå från ännu.</p>
              ) : (
                <select
                  id="source-select"
                  className={selectClass}
                  value={sourceId || mySessions[0]?.id || ""}
                  onChange={(event) => setSourceId(event.target.value)}
                >
                  {mySessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {mode === "blank" && (
            <>
              <div className="space-y-1">
                <Label htmlFor="new-title">Titel (obligatorisk)</Label>
                <Input
                  id="new-title"
                  value={draft.title}
                  placeholder="T.ex. Tisdagsträning – press"
                  onChange={(event) => set({ title: event.target.value })}
                />
              </div>
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
            </>
          )}

          <div className="space-y-1">
            <Label htmlFor="new-event">Koppla till träning i kalendern (frivilligt)</Label>
            {events.isLoading ? (
              <p className="text-sm text-muted-foreground">Hämtar kommande träningar…</p>
            ) : trainingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Det finns inga kommande träningar i kalendern att koppla till.
              </p>
            ) : (
              <select
                id="new-event"
                className={selectClass}
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
              >
                <option value="">Ingen koppling</option>
                {trainingEvents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {eventOptionLabel(item)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Skapar…" : "Skapa och fortsätt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-lg border p-3 text-left ${active ? "border-primary bg-primary/10" : "border-border"}`}
    >
      {icon}
      <span className="mt-1 block text-sm font-semibold">{title}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
