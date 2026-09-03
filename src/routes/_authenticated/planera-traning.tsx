import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarPlus, ClipboardList, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EventManager } from "@/components/EventManager";
import { Button } from "@/components/ui/button";
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
import { useAccount } from "@/hooks/useAccount";
import { fetchUpcomingEvents } from "@/lib/event-planning";
import { EventCoaches } from "@/components/EventCoaches";
import { coachSummary, fetchEventCoaches } from "@/lib/event-coaches";
import { PlanStatusBadge, planStatusBar } from "@/components/PlanStatusBadge";
import { planStatus } from "@/lib/plan-status";
import { createCoachDrill, fetchCoachDrills, validateCoachDrill } from "@/lib/coach-drills";
import { fetchAllSessionItems, fetchCoachSessions, totalMinutes } from "@/lib/coach-sessions";
import {
  fetchEventPlan,
  fetchEventPlans,
  fetchEventResources,
  saveTrainingPlan,
  upcomingOfType,
} from "@/lib/planning";
import {
  addDraftItem,
  clearDraft,
  draftMinutes,
  draftPayload,
  emptyDraft,
  hasResource,
  loadDraft,
  moveDraftItem,
  removeDraftItem,
  storeDraft,
  updateDraftItem,
  type TrainingDraft,
} from "@/lib/training-draft";
import { fetchDrills } from "@/lib/taktikbank";
import { formatDateTime } from "@/lib/teams";
import { eventTitleLine } from "@/lib/event-labels";

type Search = { eventId?: string | undefined; mode?: "edit" | undefined; markera?: string | undefined };

export const Route = createFileRoute("/_authenticated/planera-traning")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    eventId: typeof search["eventId"] === "string" && search["eventId"] ? (search["eventId"] as string) : undefined,
    mode: search["mode"] === "edit" ? "edit" : undefined,
    markera: typeof search["markera"] === "string" && search["markera"] ? (search["markera"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Planera träning – boka och fyll träningen med övningar" },
      {
        name: "description",
        content: "Boka träningstillfällen i lagets kalender och planera innehållet med övningar ur Träningsbanken.",
      },
      { property: "og:title", content: "Planera träning" },
      { property: "og:description", content: "Boka träningstillfälle och planera innehållet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanTrainingPage,
});

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function PlanTrainingPage() {
  const { user, memberships, loading } = useAccount();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const eventId = search.eventId ?? null;
  const [view, setView] = useState<"start" | "book">("start");

  const coachTeams = memberships.filter((item) => item.status === "approved" && item.role === "coach");
  const [teamId, setTeamId] = useState<string>("");
  const activeTeam = teamId || coachTeams[0]?.team_id || "";

  const events = useQuery({ queryKey: ["upcoming-events"], queryFn: () => fetchUpcomingEvents() });
  const trainings = useMemo(() => upcomingOfType(events.data ?? [], "training"), [events.data]);
  const ids = trainings.map((item) => item.id);
  const selected = trainings.find((item) => item.id === eventId) ?? null;

  const resources = useQuery({
    queryKey: ["event-resources", ids.join(",")],
    queryFn: () => fetchEventResources(ids),
    enabled: ids.length > 0,
  });

  const plans = useQuery({
    queryKey: ["event-plans", ids.join(",")],
    queryFn: () => fetchEventPlans(ids),
    enabled: ids.length > 0,
  });

  const coaches = useQuery({
    queryKey: ["event-coaches", ids.join(",")],
    queryFn: () => fetchEventCoaches(ids),
    enabled: ids.length > 0,
  });

  const plan = useQuery({
    queryKey: ["event-plan", eventId],
    queryFn: () => fetchEventPlan(eventId as string),
    enabled: !!eventId,
  });

  const drills = useQuery({ queryKey: ["tb-drills"], queryFn: fetchDrills });
  const ownDrills = useQuery({ queryKey: ["coach-drills"], queryFn: fetchCoachDrills });
  const sessions = useQuery({ queryKey: ["coach-sessions"], queryFn: fetchCoachSessions });
  const items = useQuery({ queryKey: ["coach-session-items"], queryFn: fetchAllSessionItems });
  const keeperDrills = useQuery({ queryKey: ["tb-goalkeeper"], queryFn: fetchGoalkeeperCards });

  /** Riktigt namn på en planrad, oavsett var innehållet kommer ifrån. */
  function titleFor(kind: string, resourceId: string): string {
    if (kind === "session") {
      return (sessions.data ?? []).find((row) => row.id === resourceId)?.title ?? "Träningspass";
    }
    if (kind === "goalkeeper") {
      return (keeperDrills.data ?? []).find((row) => row.id === resourceId)?.title ?? "Målvaktsövning";
    }
    return (
      (drills.data ?? []).find((row) => row.id === resourceId)?.title ??
      (ownDrills.data ?? []).find((row) => row.id === resourceId)?.title ??
      "Övning"
    );
  }

  /** Gemensam statusregel: klar när planen är sparad och innehåller minst en övning. */
  function statusFor(id: string) {
    const saved = (plans.data ?? []).some((row) => row.event_id === id);
    const count = (resources.data ?? []).filter((row) => row.event_id === id).length;
    return planStatus({ type: "training", planSaved: saved, resourceCount: count });
  }

  // ---------- utkast ----------
  const [draft, setDraft] = useState<TrainingDraft | null>(null);
  const publishedRows = useMemo(
    () => (resources.data ?? []).filter((row) => row.event_id === eventId && row.kind !== "tactic"),
    [resources.data, eventId],
  );

  useEffect(() => {
    if (!eventId) {
      setDraft(null);
      return;
    }
    const stored = loadDraft(eventId);
    if (stored) {
      setDraft(stored);
      return;
    }
    if (resources.isLoading || plan.isLoading) return;
    const initial: TrainingDraft = {
      eventId,
      notes: plan.data?.notes ?? "",
      items: publishedRows.map((row) => ({
        key: row.id,
        kind: row.kind === "session" ? "session" : row.kind === "goalkeeper" ? "goalkeeper" : "drill",
        resourceId: row.resource_id,
        title: titleFor(row.kind, row.resource_id),
        minutes: row.minutes,
        note: row.note,
      })),
    };
    setDraft(initial);
    // Utkastet läggs direkt i sessionStorage så att redan sparade övningar finns
    // kvar när användaren hämtar en ny övning i Träningsbanken.
    storeDraft(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, resources.isLoading, plan.isLoading, publishedRows.length]);


  /** Alla ändringar går via utkastet och sparas i sessionStorage. */
  function update(next: TrainingDraft) {
    setDraft(next);
    storeDraft(next);
  }

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!user || !selected || !draft) throw new Error("Välj en träning först.");
      await saveTrainingPlan({
        eventId: selected.id,
        teamId: selected.team_id,
        notes: draft.notes,
        items: draftPayload(draft),
      });
    },
    onSuccess: () => {
      if (eventId) clearDraft(eventId);
      queryClient.invalidateQueries({ queryKey: ["event-resources"] });
      queryClient.invalidateQueries({ queryKey: ["event-plan"] });
      queryClient.invalidateQueries({ queryKey: ["event-plans"] });
      toast.success("Träningsplaneringen har sparats.");
      navigate({ to: "/planera-traning", search: { markera: eventId ?? undefined } });
    },
    onError: (error: Error) => toast.error(error.message || "Det gick inte att spara träningsplaneringen."),
  });

  // ---------- egen övning ----------
  const [ownOpen, setOwnOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    minutes: "10",
    instruction: "",
    purpose: "",
    equipment: "",
    focus: "",
    library: false,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const addOwnDrill = useMutation({
    mutationFn: async () => {
      if (!user || !selected) throw new Error("Välj en träning först.");
      const problem = validateCoachDrill(form);
      if (problem) throw new Error(problem);
      return createCoachDrill(
        {
          title: form.title,
          minutes: Number(form.minutes),
          instruction: form.instruction,
          purpose: form.purpose,
          equipment: form.equipment,
          coachFocus: form.focus,
          inLibrary: form.library,
          teamId: selected.team_id,
        },
        user.id,
      );
    },
    onSuccess: (created) => {
      if (!draft) return;
      update(
        addDraftItem(draft, {
          kind: "drill",
          resourceId: created.id,
          title: created.title,
          minutes: created.minutes,
          note: created.coach_focus ? `Fokus: ${created.coach_focus}` : null,
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["coach-drills"] });
      setOwnOpen(false);
      setFormError(null);
      setForm({ title: "", minutes: "10", instruction: "", purpose: "", equipment: "", focus: "", library: false });
      toast.success("Övningen lades till i träningen.");
    },
    onError: (error: Error) => setFormError(error.message),
  });

  // ---------- dubblett ----------
  const [duplicate, setDuplicate] = useState<{ id: string; title: string; minutes: number | null } | null>(null);

  function addSessionToDraft(sessionId: string, title: string, minutes: number | null) {
    if (!draft) return;
    update(addDraftItem(draft, { kind: "session", resourceId: sessionId, title, minutes, note: null }));
    toast.success("Träningspasset lades till i utkastet.");
  }

  const highlight = search.markera ?? null;

  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-6 md:pt-20">
      <h1 className="font-display text-3xl font-bold">Planera träning</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Boka ett träningstillfälle i lagets kalender och fyll det sedan med övningar.
      </p>

      {!eventId && view === "start" && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setView("book")}
              className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"
            >
              <CalendarPlus className="size-6 text-primary" aria-hidden />
              <h2 className="mt-3 font-display text-xl font-semibold">Boka träningstillfälle</h2>
              <p className="mt-1 text-sm text-muted-foreground">Datum, tid och plats. Träningen hamnar i kalendern.</p>
            </button>
            <div className="rounded-xl border border-border bg-card p-5">
              <ClipboardList className="size-6 text-primary" aria-hidden />
              <h2 className="mt-3 font-display text-xl font-semibold">Planera ett träningstillfälle</h2>
              <p className="mt-1 text-sm text-muted-foreground">Välj en träning i listan nedan.</p>
            </div>
          </div>

          <h2 className="mt-8 font-display text-xl font-semibold">Alla träningstillfällen</h2>
          {events.isLoading && <p className="mt-2 text-sm text-muted-foreground">Hämtar kommande träningar…</p>}
          {!events.isLoading && trainings.length === 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">Det finns inga kommande träningar att planera.</p>
              <Button className="mt-3" onClick={() => setView("book")}>
                <Plus className="size-4" /> Boka en träning
              </Button>
            </div>
          )}
          <ul className="mt-3 space-y-2">
            {trainings.map((event) => {
              const status = statusFor(event.id);
              return (
                <li key={event.id}>
                  <Link
                    to="/planera-traning"
                    search={{ eventId: event.id, mode: "edit" }}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                      highlight === event.id
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/60"
                    }`}
                  >
                    <span className={`mt-1 h-10 w-1.5 shrink-0 rounded-full ${planStatusBar(status)}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs tracking-wide text-muted-foreground">Träning</span>
                      {eventTitleLine(event) && (
                        <span className="block font-semibold">{eventTitleLine(event)}</span>
                      )}
                      <span className="block text-sm text-primary">{formatDateTime(event.starts_at)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {event.team_name ?? "Lag"}
                        {event.location ? ` · ${event.location}` : ""}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {coachSummary((coaches.data ?? []).filter((row) => row.event_id === event.id))}
                      </span>
                    </span>
                    <PlanStatusBadge status={status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {!eventId && view === "book" && (
        <section className="mt-6 space-y-4">
          <Button variant="ghost" onClick={() => setView("start")}>
            ← Tillbaka
          </Button>
          {coachTeams.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {loading ? "Hämtar dina lag…" : "Du behöver vara tränare i ett lag för att boka träningar."}
            </p>
          ) : (
            <>
              {coachTeams.length > 1 && (
                <div className="space-y-1.5">
                  <Label htmlFor="training-team">Lag</Label>
                  <select
                    id="training-team"
                    className={selectClass}
                    value={activeTeam}
                    onChange={(event) => setTeamId(event.target.value)}
                  >
                    {coachTeams.map((item) => (
                      <option key={item.team_id} value={item.team_id}>
                        {item.team?.name ?? "Lag"}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {activeTeam && (
                <EventManager
                  teamId={activeTeam}
                  userId={user?.id ?? null}
                  isCoach
                  type="training"
                  title="Träningstillfällen"
                  newLabel="Boka träningstillfälle"
                  savedMessage="Träningen har lagts till i kalendern."
                />
              )}
            </>
          )}
        </section>
      )}

      {eventId && (
        <section className="mt-6 space-y-6">
          <Button variant="ghost" asChild>
            <Link to="/planera-traning" search={{}}>
              ← Tillbaka till alla träningstillfällen
            </Link>
          </Button>

          {!selected && <p className="text-sm text-muted-foreground">Hämtar träningen…</p>}

          {selected && (
            <>
              <div className="rounded-xl border border-primary bg-primary/10 p-4">
                <p className="text-xs tracking-wide text-muted-foreground">Träning</p>
                {eventTitleLine(selected) && <p className="font-semibold">{eventTitleLine(selected)}</p>}
                <p className="text-sm text-primary">{formatDateTime(selected.starts_at)}</p>
                <p className="text-xs text-muted-foreground">
                  {selected.team_name ?? "Lag"}
                  {selected.location ? (
                    <span className="ml-1 inline-flex items-center gap-1">
                      <MapPin className="size-3" aria-hidden /> {selected.location}
                    </span>
                  ) : null}
                </p>
                <div className="mt-2">
                  <PlanStatusBadge status={statusFor(selected.id)} />
                </div>
              </div>

              <div>
                <h2 className="font-display text-xl font-semibold">Steg 2 – Ansvariga tränare</h2>
                <div className="mt-3">
                  <EventCoaches
                    eventId={selected.id}
                    teamId={selected.team_id}
                    userId={user?.id ?? null}
                    canEdit={coachTeams.some((item) => item.team_id === selected.team_id)}
                  />
                </div>
              </div>

              <div>
                <h2 className="font-display text-xl font-semibold">Steg 3 – Lägg till övningar</h2>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setOwnOpen(true)}
                    className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"
                  >
                    <Plus className="size-6 text-primary" aria-hidden />
                    <span className="mt-3 block font-display text-lg font-semibold">Skapa egen övning</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      Skriv en egen övning direkt i den här träningen.
                    </span>
                  </button>
                  <Link
                    to="/ovningsbank"
                    search={{ eventId: selected.id, teamId: selected.team_id }}
                    className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"
                  >
                    <BookOpen className="size-6 text-primary" aria-hidden />
                    <span className="mt-3 block font-display text-lg font-semibold">Hämta från Träningsbanken</span>
                    <span className="mt-1 block text-sm text-muted-foreground">
                      Plocka färdiga övningar. Du kommer tillbaka hit efteråt.
                    </span>
                  </Link>
                </div>

                <details className="mt-4 rounded-xl border border-border bg-card p-4">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Avancerat – lägg till ett helt träningspass
                  </summary>
                  <ul className="mt-3 space-y-2">
                    {(sessions.data ?? []).length === 0 && (
                      <li className="text-sm text-muted-foreground">Du har inga egna träningspass ännu.</li>
                    )}
                    {(sessions.data ?? []).map((session) => {
                      const own = (items.data ?? []).filter((item) => item.session_id === session.id);
                      return (
                        <li
                          key={session.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                        >
                          <span className="min-w-0">
                            <span className="block font-semibold">{session.title}</span>
                            <span className="block text-xs text-muted-foreground">
                              {totalMinutes(own)} min · {own.length} delar
                            </span>
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addSessionToDraft(session.id, session.title, totalMinutes(own) || null)}
                          >
                            Lägg till i träningen
                          </Button>
                        </li>
                      );
                    })}
                    <li>
                      <Link to="/traningspass" className="text-sm text-primary underline-offset-4 hover:underline">
                        Bygg ett nytt återanvändbart träningspass
                      </Link>
                    </li>
                  </ul>
                </details>
              </div>

              <div>
                <h2 className="font-display text-xl font-semibold">Steg 4 – Granska och spara</h2>
                <div className="mt-3 rounded-xl border border-border bg-card p-4">
                  <ul className="space-y-2">
                    {(draft?.items.length ?? 0) === 0 && (
                      <li className="text-sm text-muted-foreground">Inga övningar tillagda ännu.</li>
                    )}
                    {(draft?.items ?? []).map((item, index) => (
                      <li key={item.key} className="rounded-lg border border-border px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {index + 1}. {item.title}
                              {item.minutes ? ` – ${item.minutes} min` : ""}
                            </p>
                            {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
                          </div>
                          <span className="flex shrink-0 gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Flytta upp"
                              disabled={index === 0}
                              onClick={() => draft && update(moveDraftItem(draft, index, -1))}
                            >
                              ↑
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Flytta ner"
                              disabled={index === (draft?.items.length ?? 0) - 1}
                              onClick={() => draft && update(moveDraftItem(draft, index, 1))}
                            >
                              ↓
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Ta bort"
                              onClick={() => draft && update(removeDraftItem(draft, item.key))}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </span>
                        </div>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[7rem_1fr]">
                          <Input
                            type="number"
                            min={0}
                            max={180}
                            aria-label={`Tid för ${item.title}`}
                            value={item.minutes ?? ""}
                            onChange={(event) =>
                              draft &&
                              update(
                                updateDraftItem(draft, item.key, {
                                  minutes: event.target.value === "" ? null : Number(event.target.value),
                                }),
                              )
                            }
                          />
                          <Input
                            aria-label={`Anteckning för ${item.title}`}
                            placeholder="Anteckning, t.ex. Fokus: lyfta blicken"
                            value={item.note ?? ""}
                            onChange={(event) =>
                              draft && update(updateDraftItem(draft, item.key, { note: event.target.value || null }))
                            }
                          />
                        </div>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-3 text-sm font-semibold">
                    Total träningstid: {draft ? draftMinutes(draft) : 0} minuter
                  </p>

                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="plan-notes">Anteckningar</Label>
                    <Textarea
                      id="plan-notes"
                      rows={3}
                      value={draft?.notes ?? ""}
                      onChange={(event) => draft && update({ ...draft, notes: event.target.value })}
                      placeholder="T.ex. dela in i två grupper"
                    />
                  </div>

                  <Button className="mt-4" onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>
                    {plan.data ? "Spara ändringar" : "Spara träningsplaneringen"}
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Ändringarna sparas först när du trycker här. Träningen blir grön Klar när minst en övning finns.
                  </p>
                </div>
              </div>
            </>
          )}
        </section>
      )}

      <Dialog open={ownOpen} onOpenChange={setOwnOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Skapa egen övning</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="own-title">Titel *</Label>
              <Input
                id="own-title"
                value={form.title}
                onChange={(event) => setForm((state) => ({ ...state, title: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="own-minutes">Tid i minuter *</Label>
              <Input
                id="own-minutes"
                type="number"
                min={1}
                max={180}
                value={form.minutes}
                onChange={(event) => setForm((state) => ({ ...state, minutes: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="own-instruction">Kort instruktion</Label>
              <Textarea
                id="own-instruction"
                rows={2}
                value={form.instruction}
                onChange={(event) => setForm((state) => ({ ...state, instruction: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="own-purpose">Syfte</Label>
              <Input
                id="own-purpose"
                value={form.purpose}
                onChange={(event) => setForm((state) => ({ ...state, purpose: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="own-equipment">Utrustning (valfritt)</Label>
              <Input
                id="own-equipment"
                value={form.equipment}
                onChange={(event) => setForm((state) => ({ ...state, equipment: event.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="own-focus">Tränarens fokus (valfritt)</Label>
              <Input
                id="own-focus"
                value={form.focus}
                onChange={(event) => setForm((state) => ({ ...state, focus: event.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={form.library}
                onChange={(event) => setForm((state) => ({ ...state, library: event.target.checked }))}
              />
              Spara även i Träningsbanken
            </label>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOwnOpen(false)}>
              Avbryt
            </Button>
            <Button onClick={() => addOwnDrill.mutate()} disabled={addOwnDrill.isPending}>
              Lägg till i träningen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!duplicate} onOpenChange={(open) => !open && setDuplicate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Övningen finns redan i träningen. Vill du lägga till den en gång till?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDuplicate(null)}>
              Avbryt
            </Button>
            <Button
              onClick={() => {
                if (draft && duplicate) {
                  update(
                    addDraftItem(draft, {
                      kind: "drill",
                      resourceId: duplicate.id,
                      title: duplicate.title,
                      minutes: duplicate.minutes,
                      note: null,
                    }),
                  );
                  toast.success("Övningen lades till en gång till.");
                }
                setDuplicate(null);
              }}
            >
              Lägg till igen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

/** Exporteras för att hålla dubblettdialogen testbar. */
export function wouldDuplicate(draft: TrainingDraft, resourceId: string): boolean {
  return hasResource(draft, resourceId);
}

export { emptyDraft };
