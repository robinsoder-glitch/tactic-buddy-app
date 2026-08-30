import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ClipboardList, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EventManager } from "@/components/EventManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "@/hooks/useAccount";
import { addResourceToEvent, fetchUpcomingEvents } from "@/lib/event-planning";
import {
  fetchAllSessionItems,
  fetchCoachSessions,
  totalMinutes,
  type CoachSession,
} from "@/lib/coach-sessions";
import {
  fetchEventPlan,
  fetchEventPlans,
  fetchEventResources,
  moveEventResource,
  planningStatus,
  plannedLabel,
  removeEventResource,
  saveEventPlan,
  sumMinutes,
  upcomingOfType,
} from "@/lib/planning";
import { formatDateTime } from "@/lib/teams";

export const Route = createFileRoute("/_authenticated/planera-traning")({
  head: () => ({
    meta: [
      { title: "Planera träning – boka och fyll träningen med innehåll" },
      {
        name: "description",
        content:
          "Boka träningstillfällen i lagets kalender och planera innehållet med träningspass ur Träningsbanken.",
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
  const [view, setView] = useState<"start" | "book" | "plan">("start");
  const [eventId, setEventId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState("");

  const coachTeams = memberships.filter((item) => item.status === "approved" && item.role === "coach");
  const [teamId, setTeamId] = useState<string>("");
  const activeTeam = teamId || coachTeams[0]?.team_id || "";

  const events = useQuery({ queryKey: ["upcoming-events"], queryFn: () => fetchUpcomingEvents() });
  const trainings = useMemo(() => upcomingOfType(events.data ?? [], "training"), [events.data]);
  const selected = trainings.find((item) => item.id === eventId) ?? null;

  const resources = useQuery({
    queryKey: ["event-resources", trainings.map((item) => item.id).join(",")],
    queryFn: () => fetchEventResources(trainings.map((item) => item.id)),
    enabled: trainings.length > 0,
  });

  const plan = useQuery({
    queryKey: ["event-plan", eventId],
    queryFn: () => fetchEventPlan(eventId as string),
    enabled: !!eventId,
  });

  const plans = useQuery({
    queryKey: ["event-plans", trainings.map((item) => item.id).join(",")],
    queryFn: () => fetchEventPlans(trainings.map((item) => item.id)),
    enabled: trainings.length > 0,
  });

  /** Planeringsstatus för varje träningstillfälle. */
  function statusFor(id: string) {
    return planningStatus(id, plans.data ?? [], resources.data ?? []);
  }

  const sessions = useQuery({ queryKey: ["coach-sessions"], queryFn: fetchCoachSessions });
  const items = useQuery({ queryKey: ["coach-session-items"], queryFn: fetchAllSessionItems });

  const selectedResources = (resources.data ?? []).filter((row) => row.event_id === eventId);

  const addSession = useMutation({
    mutationFn: async (session: CoachSession) => {
      if (!user || !selected) throw new Error("Välj en träning först.");
      const minutes = totalMinutes((items.data ?? []).filter((item) => item.session_id === session.id));
      await addResourceToEvent({
        eventId: selected.id,
        teamId: selected.team_id,
        userId: user.id,
        kind: "session",
        resourceId: session.id,
        minutes: minutes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-resources"] });
      toast.success("Träningspasset lades till i träningen.");
    },
    onError: () => toast.error("Det gick inte att lägga till träningspasset."),
  });

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!user || !selected) throw new Error("Välj en träning först.");
      await saveEventPlan({
        eventId: selected.id,
        teamId: selected.team_id,
        userId: user.id,
        notes: notes || plan.data?.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-plan"] });
      toast.success("Träningsplaneringen har sparats.");
    },
    onError: () => toast.error("Det gick inte att spara träningsplaneringen."),
  });

  const sessionList = (sessions.data ?? []).filter((session) =>
    `${session.title} ${session.theme ?? ""} ${session.goal ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-6 md:pt-20">
      <h1 className="font-display text-3xl font-bold">Planera träning</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Boka ett träningstillfälle i lagets kalender och fyll det sedan med innehåll.
      </p>

      {view === "start" && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setView("book")}
            className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"
          >
            <CalendarPlus className="size-6 text-primary" aria-hidden />
            <h2 className="mt-3 font-display text-xl font-semibold">Boka träningstillfälle</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Välj lag, datum, tid och plats. Träningen hamnar direkt i lagets kalender.
            </p>
          </button>
          <button
            type="button"
            onClick={() => setView("plan")}
            className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"
          >
            <ClipboardList className="size-6 text-primary" aria-hidden />
            <h2 className="mt-3 font-display text-xl font-semibold">Planera ett träningstillfälle</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Välj en kommande träning och lägg till träningspass ur Träningsbanken.
            </p>
          </button>
        </div>
      )}

      {view === "start" && (
        <section className="mt-8">
          <h2 className="font-display text-xl font-semibold">Alla träningstillfällen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Här ser du vilka träningar som har en färdig planering och vilka som är oplanerade.
          </p>
          {events.isLoading && <p className="mt-3 text-sm text-muted-foreground">Hämtar träningar…</p>}
          {!events.isLoading && trainings.length === 0 && (
            <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Inga kommande träningar bokade ännu.
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {trainings.map((event) => {
              const status = statusFor(event.id);
              const count = (resources.data ?? []).filter((row) => row.event_id === event.id).length;
              const badge =
                status === "done"
                  ? { text: "Planerad", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" }
                  : status === "started"
                    ? { text: "Påbörjad", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" }
                    : { text: "Oplanerad", cls: "bg-destructive/15 text-destructive" };
              return (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{event.title ?? "Träning"}</p>
                    <p className="text-sm text-primary">{formatDateTime(event.starts_at)}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.team_name ?? "Lag"} · {plannedLabel(count)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>
                      {badge.text}
                    </span>
                    <Button size="sm" variant="secondary" asChild>
                      <Link
                        to="/team/$teamId/event/$eventId"
                        params={{ teamId: event.team_id, eventId: event.id }}
                      >
                        Öppna
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {view === "book" && (
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
                  <Label htmlFor="team">Lag</Label>
                  <select
                    id="team"
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

      {view === "plan" && (
        <section className="mt-6 space-y-6">
          <Button variant="ghost" onClick={() => setView("start")}>
            ← Tillbaka
          </Button>

          <div>
            <h2 className="font-display text-xl font-semibold">Steg 1 – Välj träning</h2>
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
                const count = (resources.data ?? []).filter((row) => row.event_id === event.id).length;
                const active = event.id === eventId;
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => setEventId(event.id)}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        active ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/60"
                      }`}
                    >
                      <p className="font-semibold">{event.title ?? "Träning"}</p>
                      <p className="text-sm text-primary">{formatDateTime(event.starts_at)}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.team_name ?? "Lag"}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{plannedLabel(count)}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {selected && (
            <>
              <div>
                <h2 className="font-display text-xl font-semibold">Steg 2 – Välj träningsinnehåll</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" asChild>
                    <Link to="/ovningsbank">Välj från Träningsbanken</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/traningspass">Skapa ett eget träningspass</Link>
                  </Button>
                </div>

                <div className="mt-4 space-y-2">
                  <Label htmlFor="sok" className="flex items-center gap-2">
                    <Search className="size-4" aria-hidden /> Sök bland dina träningspass
                  </Label>
                  <Input
                    id="sok"
                    value={query}
                    placeholder="T.ex. passningsspel"
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>

                <ul className="mt-3 space-y-2">
                  {sessionList.length === 0 && (
                    <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                      Inga träningspass matchar sökningen.
                    </li>
                  )}
                  {sessionList.map((session) => {
                    const own = (items.data ?? []).filter((item) => item.session_id === session.id);
                    return (
                      <li
                        key={session.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">{session.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {[
                              session.age_group ? `Ålder: ${session.age_group}` : null,
                              session.game_format ? `Spelform: ${session.game_format}` : null,
                              session.theme ? `Tema: ${session.theme}` : null,
                              `Tid: ${totalMinutes(own)} min`,
                              `${own.length} delar`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {session.goal && <p className="mt-1 text-sm text-muted-foreground">{session.goal}</p>}
                        </div>
                        <Button size="sm" onClick={() => addSession.mutate(session)} disabled={addSession.isPending}>
                          Lägg till i träningen
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div>
                <h2 className="font-display text-xl font-semibold">Steg 3 – Granska och spara</h2>
                <div className="mt-3 rounded-xl border border-border bg-card p-4">
                  <p className="font-semibold">{selected.title ?? "Träning"}</p>
                  <p className="text-sm text-primary">{formatDateTime(selected.starts_at)}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.team_name ?? "Lag"}
                    {selected.location ? (
                      <span className="ml-1 inline-flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden /> {selected.location}
                      </span>
                    ) : null}
                  </p>

                  <ul className="mt-3 space-y-2">
                    {selectedResources.length === 0 && (
                      <li className="text-sm text-muted-foreground">Inget innehåll tillagt ännu.</li>
                    )}
                    {selectedResources.map((row, index) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate">
                          {index + 1}.{" "}
                          {(sessions.data ?? []).find((session) => session.id === row.resource_id)?.title ??
                            "Innehåll från banken"}
                          {row.minutes ? ` · ${row.minutes} min` : ""}
                        </span>
                        <span className="flex shrink-0 gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Flytta upp"
                            onClick={async () => {
                              await moveEventResource(selectedResources, index, -1);
                              queryClient.invalidateQueries({ queryKey: ["event-resources"] });
                            }}
                          >
                            ↑
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Flytta ner"
                            onClick={async () => {
                              await moveEventResource(selectedResources, index, 1);
                              queryClient.invalidateQueries({ queryKey: ["event-resources"] });
                            }}
                          >
                            ↓
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Ta bort"
                            onClick={async () => {
                              await removeEventResource(row.id);
                              queryClient.invalidateQueries({ queryKey: ["event-resources"] });
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-3 text-sm font-semibold">
                    Total beräknad tid: {sumMinutes(selectedResources)} minuter
                  </p>

                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="plan-notes">Anteckningar</Label>
                    <Textarea
                      id="plan-notes"
                      rows={3}
                      value={notes || (plan.data?.notes ?? "")}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="T.ex. dela in i två grupper"
                    />
                  </div>

                  <Button className="mt-3" onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>
                    Spara träningsplaneringen
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Planeringen syns på aktiviteten i lagets kalender under ”Planerat träningsinnehåll”.
                  </p>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
