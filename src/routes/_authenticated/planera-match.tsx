import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ListChecks, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { EventManager } from "@/components/EventManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "@/hooks/useAccount";
import { addResourceToEvent, fetchUpcomingEvents } from "@/lib/event-planning";
import { fetchTactics } from "@/lib/db";
import { fetchTacticCards } from "@/lib/taktikbank";
import { PlanStatusBadge, planStatusBar } from "@/components/PlanStatusBadge";
import { planStatus } from "@/lib/plan-status";
import { fetchEventCoaches } from "@/lib/event-coaches";
import {
  fetchEventPlan,
  fetchEventPlans,
  fetchEventResources,
  fetchSquad,
  fetchSquads,
  removeEventResource,
  saveMatchPlan,
  selectionLabel,
  toggleSelection,
  upcomingOfType,
} from "@/lib/planning";
import { fetchTeamMembers, fetchTeamPlayers, formatDateTime } from "@/lib/teams";
import { eventTitleLine } from "@/lib/event-labels";

type Search = { eventId?: string | undefined; mode?: "edit" | undefined };

export const Route = createFileRoute("/_authenticated/planera-match")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    eventId:
      typeof search["eventId"] === "string" && search["eventId"] ? (search["eventId"] as string) : undefined,
    mode: search["mode"] === "edit" ? "edit" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Planera match – ta ut trupp och ansvariga ledare" },
      {
        name: "description",
        content: "Lägg till matcher i lagets kalender och planera matchen med spelaruttagning, ledare och taktik.",
      },
      { property: "og:title", content: "Planera match" },
      { property: "og:description", content: "Lägg till match, ta ut trupp och välj ledare." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanMatchPage,
});

const selectClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function PlanMatchPage() {
  const { user, memberships, loading } = useAccount();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const eventId = search.eventId ?? null;

  const [view, setView] = useState<"start" | "book">("start");
  const [teamId, setTeamId] = useState("");
  const [query, setQuery] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedCoaches, setSelectedCoaches] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<{ players?: string; coaches?: string }>({});

  const coachTeams = memberships.filter((item) => item.status === "approved" && item.role === "coach");
  const activeTeam = teamId || coachTeams[0]?.team_id || "";

  const events = useQuery({ queryKey: ["upcoming-events"], queryFn: () => fetchUpcomingEvents() });
  const matches = useMemo(() => upcomingOfType(events.data ?? [], "match"), [events.data]);
  const ids = matches.map((item) => item.id);
  const selected = matches.find((item) => item.id === eventId) ?? null;

  const plans = useQuery({
    queryKey: ["event-plans", ids.join(",")],
    queryFn: () => fetchEventPlans(ids),
    enabled: ids.length > 0,
  });
  const squads = useQuery({
    queryKey: ["event-squads", ids.join(",")],
    queryFn: () => fetchSquads(ids),
    enabled: ids.length > 0,
  });
  const allCoaches = useQuery({
    queryKey: ["event-coaches", ids.join(",")],
    queryFn: () => fetchEventCoaches(ids),
    enabled: ids.length > 0,
  });

  /** Gemensam statusregel: klar när planen är sparad och har spelare och ledare. */
  function statusFor(id: string) {
    return planStatus({
      type: "match",
      planSaved: (plans.data ?? []).some((row) => row.event_id === id),
      playerCount: (squads.data ?? []).filter((row) => row.event_id === id).length,
      coachCount: (allCoaches.data ?? []).filter((row) => row.event_id === id).length,
    });
  }

  const players = useQuery({
    queryKey: ["team-players", selected?.team_id],
    queryFn: () => fetchTeamPlayers(selected?.team_id as string),
    enabled: !!selected?.team_id,
  });
  const members = useQuery({
    queryKey: ["team-members", selected?.team_id],
    queryFn: () => fetchTeamMembers(selected?.team_id as string),
    enabled: !!selected?.team_id,
  });
  const teamCoaches = (members.data ?? []).filter((row) => row.role === "coach" && row.status === "approved");

  const squad = useQuery({
    queryKey: ["event-squad", eventId],
    queryFn: () => fetchSquad(eventId as string),
    enabled: !!eventId,
  });
  const plan = useQuery({
    queryKey: ["event-plan", eventId],
    queryFn: () => fetchEventPlan(eventId as string),
    enabled: !!eventId,
  });
  const eventCoaches = useQuery({
    queryKey: ["event-coaches", eventId],
    queryFn: () => fetchEventCoaches([eventId as string]),
    enabled: !!eventId,
  });

  useEffect(() => {
    if (squad.data) setSelectedPlayers(squad.data);
  }, [squad.data]);
  useEffect(() => {
    if (eventCoaches.data) setSelectedCoaches(eventCoaches.data.map((row) => row.user_id));
  }, [eventCoaches.data]);
  useEffect(() => {
    setNotes(plan.data?.notes ?? "");
  }, [plan.data]);
  useEffect(() => {
    setDirty(false);
    setErrors({});
  }, [eventId, search.mode]);

  // Varna innan sidan lämnas med osparade ändringar.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const editing = search.mode === "edit" || (!!eventId && !plan.isLoading && !plan.data);

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!user || !selected) throw new Error("Välj en match först.");
      const problems: { players?: string; coaches?: string } = {};
      if (selectedPlayers.length === 0) problems.players = "Välj minst en spelare.";
      if (selectedCoaches.length === 0) problems.coaches = "Välj minst en ledare.";
      setErrors(problems);
      if (problems.players || problems.coaches) throw new Error("Komplettera matchplaneringen.");
      await saveMatchPlan({
        eventId: selected.id,
        teamId: selected.team_id,
        notes,
        playerIds: selectedPlayers,
        coachIds: selectedCoaches,
      });
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["event-squad"] });
      queryClient.invalidateQueries({ queryKey: ["event-squads"] });
      queryClient.invalidateQueries({ queryKey: ["event-plan"] });
      queryClient.invalidateQueries({ queryKey: ["event-plans"] });
      queryClient.invalidateQueries({ queryKey: ["event-coaches"] });
      toast.success("Matchplaneringen har sparats.");
      navigate({ to: "/planera-match", search: { eventId: eventId ?? undefined } });
    },
    onError: (error: Error) => toast.error(error.message || "Det gick inte att spara matchplaneringen."),
  });

  const myTactics = useQuery({ queryKey: ["tactics"], queryFn: fetchTactics });
  const tacticCards = useQuery({ queryKey: ["tactic-cards"], queryFn: fetchTacticCards });
  const eventResources = useQuery({
    queryKey: ["event-resources", eventId],
    queryFn: () => fetchEventResources([eventId as string]),
    enabled: !!eventId,
  });
  const matchTactics = (eventResources.data ?? []).filter((row) => row.kind === "tactic");

  function tacticTitle(id: string) {
    return (
      (myTactics.data ?? []).find((item) => item.id === id)?.name ??
      (tacticCards.data ?? []).find((item) => item.id === id)?.title ??
      "Taktik"
    );
  }

  const addTactic = useMutation({
    mutationFn: async (resourceId: string) => {
      if (!user || !selected) throw new Error("Välj en match först.");
      await addResourceToEvent({
        eventId: selected.id,
        teamId: selected.team_id,
        userId: user.id,
        kind: "tactic",
        resourceId,
        minutes: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-resources"] });
      toast.success("Taktiken kopplades till matchen.");
    },
    onError: () => toast.error("Det gick inte att koppla taktiken."),
  });

  const playerList = (players.data ?? []).filter((player) =>
    player.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const playerName = (id: string) => (players.data ?? []).find((row) => row.id === id)?.name ?? "Spelare";
  const coachName = (id: string) =>
    teamCoaches.find((row) => row.user_id === id)?.displayName ??
    (eventCoaches.data ?? []).find((row) => row.user_id === id)?.displayName ??
    "Ledare";

  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-6 md:pt-20">
      <h1 className="font-display text-3xl font-bold">Planera match</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Lägg till matchen i lagets kalender och planera trupp, ledare och taktik.
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
              <h2 className="mt-3 font-display text-xl font-semibold">Lägg till match</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Datum, tid, samling, motståndare och plats. Matchen hamnar i lagets kalender.
              </p>
            </button>
            <div className="rounded-xl border border-border bg-card p-5">
              <ListChecks className="size-6 text-primary" aria-hidden />
              <h2 className="mt-3 font-display text-xl font-semibold">Planera en match</h2>
              <p className="mt-1 text-sm text-muted-foreground">Välj en match i listan nedan.</p>
            </div>
          </div>

          <h2 className="mt-8 font-display text-xl font-semibold">Alla matcher</h2>
          {events.isLoading && <p className="mt-2 text-sm text-muted-foreground">Hämtar kommande matcher…</p>}
          {!events.isLoading && matches.length === 0 && (
            <div className="mt-3 rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">Det finns inga kommande matcher att planera.</p>
              <Button className="mt-3" onClick={() => setView("book")}>
                Lägg till match
              </Button>
            </div>
          )}
          <ul className="mt-3 space-y-2">
            {matches.map((event) => {
              const status = statusFor(event.id);
              return (
                <li key={event.id}>
                  <Link
                    to="/planera-match"
                    search={{ eventId: event.id }}
                    className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/60"
                  >
                    <span className={`mt-1 h-10 w-1.5 shrink-0 rounded-full ${planStatusBar(status)}`} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs tracking-wide text-muted-foreground">Match</span>
                      {eventTitleLine(event) && (
                        <span className="block font-semibold">{eventTitleLine(event)}</span>
                      )}
                      <span className="block text-sm text-primary">{formatDateTime(event.starts_at)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {event.team_name ?? "Lag"}
                        {event.location ? ` · ${event.location}` : ""}
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
              {loading ? "Hämtar dina lag…" : "Du behöver vara tränare i ett lag för att lägga till matcher."}
            </p>
          ) : (
            <>
              {coachTeams.length > 1 && (
                <div className="space-y-1.5">
                  <Label htmlFor="match-team">Lag</Label>
                  <select
                    id="match-team"
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
                  type="match"
                  title="Matcher"
                  newLabel="Lägg till match"
                  savedMessage="Matchen har lagts till i kalendern."
                />
              )}
            </>
          )}
        </section>
      )}

      {eventId && (
        <section className="mt-6 space-y-6">
          <Button variant="ghost" asChild>
            <Link to="/planera-match" search={{}}>
              ← Tillbaka till alla matcher
            </Link>
          </Button>

          {!selected && <p className="text-sm text-muted-foreground">Hämtar matchen…</p>}

          {selected && (
            <>
              <div className="rounded-xl border border-primary bg-primary/10 p-4">
                <p className="text-xs tracking-wide text-muted-foreground">Match</p>
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

              {!editing && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h2 className="font-display text-xl font-semibold">Matchplanering</h2>
                  <p className="mt-3 text-sm font-semibold">Valda spelare ({selectedPlayers.length})</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPlayers.length ? selectedPlayers.map(playerName).join(", ") : "Inga spelare valda."}
                  </p>
                  <p className="mt-3 text-sm font-semibold">Valda ledare ({selectedCoaches.length})</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCoaches.length ? selectedCoaches.map(coachName).join(", ") : "Inga ledare valda."}
                  </p>
                  <p className="mt-3 text-sm font-semibold">Anteckning</p>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                    {plan.data?.notes?.trim() ? plan.data.notes : "Ingen anteckning."}
                  </p>
                  <Button className="mt-4" asChild>
                    <Link to="/planera-match" search={{ eventId: selected.id, mode: "edit" }}>
                      Ändra
                    </Link>
                  </Button>
                </div>
              )}

              {editing && (
                <>
                  <div>
                    <h2 className="font-display text-xl font-semibold">Steg 1 – Välj spelare</h2>
                    <div className="mt-3 space-y-2">
                      <Label htmlFor="sok-spelare" className="flex items-center gap-2">
                        <Search className="size-4" aria-hidden /> Sök spelare
                      </Label>
                      <Input
                        id="sok-spelare"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Skriv ett namn"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedPlayers((players.data ?? []).map((player) => player.id));
                          setDirty(true);
                        }}
                      >
                        Välj alla
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedPlayers([]);
                          setDirty(true);
                        }}
                      >
                        Avmarkera alla
                      </Button>
                      <span className="text-sm font-semibold">{selectionLabel(selectedPlayers.length)}</span>
                    </div>
                    {errors.players && <p className="mt-2 text-sm text-destructive">{errors.players}</p>}

                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {players.isLoading && <li className="text-sm text-muted-foreground">Hämtar truppen…</li>}
                      {!players.isLoading && playerList.length === 0 && (
                        <li className="text-sm text-muted-foreground">Inga spelare matchar sökningen.</li>
                      )}
                      {playerList.map((player) => (
                        <li key={player.id}>
                          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3">
                            <input
                              type="checkbox"
                              className="size-5"
                              checked={selectedPlayers.includes(player.id)}
                              onChange={() => {
                                setSelectedPlayers((current) => toggleSelection(current, player.id));
                                setDirty(true);
                              }}
                            />
                            <span className="min-w-0">
                              <span className="block font-semibold">{player.name}</span>
                              {player.number !== null && (
                                <span className="block text-xs text-muted-foreground">Nummer {player.number}</span>
                              )}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h2 className="font-display text-xl font-semibold">Steg 2 – Välj ledare</h2>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setSelectedCoaches(teamCoaches.map((row) => row.user_id));
                          setDirty(true);
                        }}
                      >
                        Välj alla
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedCoaches([]);
                          setDirty(true);
                        }}
                      >
                        Avmarkera alla
                      </Button>
                      <span className="text-sm font-semibold">Valda ledare: {selectedCoaches.length}</span>
                    </div>
                    {errors.coaches && <p className="mt-2 text-sm text-destructive">{errors.coaches}</p>}
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {members.isLoading && <li className="text-sm text-muted-foreground">Hämtar ledare…</li>}
                      {!members.isLoading && teamCoaches.length === 0 && (
                        <li className="text-sm text-muted-foreground">Laget har inga registrerade ledare ännu.</li>
                      )}
                      {teamCoaches.map((member) => (
                        <li key={member.id}>
                          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3">
                            <input
                              type="checkbox"
                              className="size-5"
                              checked={selectedCoaches.includes(member.user_id)}
                              onChange={() => {
                                setSelectedCoaches((current) => toggleSelection(current, member.user_id));
                                setDirty(true);
                              }}
                            />
                            <span className="min-w-0">
                              <span className="block font-semibold">
                                {member.displayName ?? "Ledare"}
                                {member.user_id === user?.id ? " (du)" : ""}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h2 className="font-display text-xl font-semibold">Steg 3 – Koppla taktik</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="secondary" asChild>
                        <Link to="/taktik">Öppna taktiktavlan</Link>
                      </Button>
                    </div>
                    <ul className="mt-3 space-y-2">
                      {matchTactics.length === 0 && (
                        <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                          Ingen taktik kopplad till matchen ännu.
                        </li>
                      )}
                      {matchTactics.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-sm"
                        >
                          <span className="min-w-0 truncate font-semibold">{tacticTitle(row.resource_id)}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={async () => {
                              await removeEventResource(row.id);
                              queryClient.invalidateQueries({ queryKey: ["event-resources"] });
                            }}
                          >
                            Ta bort
                          </Button>
                        </li>
                      ))}
                    </ul>

                    <h3 className="mt-5 font-display text-lg font-semibold">Mina taktiker</h3>
                    <ul className="mt-2 space-y-2">
                      {(myTactics.data ?? []).length === 0 && (
                        <li className="text-sm text-muted-foreground">
                          Du har inga sparade taktiker ännu – rita en på taktiktavlan.
                        </li>
                      )}
                      {(myTactics.data ?? []).map((tactic) => (
                        <li
                          key={tactic.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                        >
                          <Link
                            to="/tactic/$id"
                            params={{ id: tactic.id }}
                            className="min-w-0 truncate font-semibold text-primary underline-offset-4 hover:underline"
                          >
                            {tactic.name}
                          </Link>
                          <Button size="sm" onClick={() => addTactic.mutate(tactic.id)} disabled={addTactic.isPending}>
                            Koppla till matchen
                          </Button>
                        </li>
                      ))}
                    </ul>

                    <h3 className="mt-5 font-display text-lg font-semibold">Färdiga taktiker</h3>
                    <ul className="mt-2 space-y-2">
                      {(tacticCards.data ?? []).slice(0, 10).map((card) => (
                        <li
                          key={card.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                        >
                          <Link
                            to="/taktikbank/$cardId"
                            params={{ cardId: card.id }}
                            className="min-w-0 truncate font-semibold text-primary underline-offset-4 hover:underline"
                          >
                            {card.title}
                          </Link>
                          <Button size="sm" onClick={() => addTactic.mutate(card.id)} disabled={addTactic.isPending}>
                            Koppla till matchen
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h2 className="font-display text-xl font-semibold">Steg 4 – Anteckning och spara</h2>
                    <div className="mt-3 rounded-xl border border-border bg-card p-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="match-notes">Egna anteckningar</Label>
                        <Textarea
                          id="match-notes"
                          rows={3}
                          value={notes}
                          onChange={(event) => {
                            setNotes(event.target.value);
                            setDirty(true);
                          }}
                          placeholder="T.ex. samling 45 minuter före avspark"
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>
                          {plan.data ? "Spara ändringar" : "Spara matchplaneringen"}
                        </Button>
                        <Button variant="outline" asChild>
                          <Link
                            to="/team/$teamId/event/$eventId"
                            params={{ teamId: selected.team_id, eventId: selected.id }}
                          >
                            Hantera kallelse
                          </Link>
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Matchen blir grön Klar när minst en spelare och en ledare är valda.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
