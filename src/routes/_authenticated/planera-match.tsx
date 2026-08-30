import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ListChecks, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { EventManager } from "@/components/EventManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "@/hooks/useAccount";
import { fetchUpcomingEvents } from "@/lib/event-planning";
import {
  fetchEventPlan,
  fetchSquad,
  saveEventPlan,
  saveSquad,
  selectionLabel,
  toggleSelection,
  upcomingOfType,
} from "@/lib/planning";
import { fetchTeamPlayers, formatDateTime } from "@/lib/teams";

export const Route = createFileRoute("/_authenticated/planera-match")({
  head: () => ({
    meta: [
      { title: "Planera match – lägg till matchen och ta ut truppen" },
      {
        name: "description",
        content: "Lägg till matcher i lagets kalender och planera matchen med spelaruttagning och anteckningar.",
      },
      { property: "og:title", content: "Planera match" },
      { property: "og:description", content: "Lägg till match och planera truppen." },
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
  const [view, setView] = useState<"start" | "book" | "plan">("start");
  const [eventId, setEventId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState("");
  const [query, setQuery] = useState("");
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const coachTeams = memberships.filter((item) => item.status === "approved" && item.role === "coach");
  const activeTeam = teamId || coachTeams[0]?.team_id || "";

  const events = useQuery({ queryKey: ["upcoming-events"], queryFn: () => fetchUpcomingEvents() });
  const matches = useMemo(() => upcomingOfType(events.data ?? [], "match"), [events.data]);
  const selected = matches.find((item) => item.id === eventId) ?? null;

  const players = useQuery({
    queryKey: ["team-players", selected?.team_id],
    queryFn: () => fetchTeamPlayers(selected?.team_id as string),
    enabled: !!selected?.team_id,
  });

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

  useEffect(() => {
    if (squad.data) setSelectedPlayers(squad.data);
  }, [squad.data]);

  useEffect(() => {
    setNotes(plan.data?.notes ?? "");
  }, [plan.data]);

  const savePlan = useMutation({
    mutationFn: async () => {
      if (!user || !selected) throw new Error("Välj en match först.");
      await saveSquad({
        eventId: selected.id,
        teamId: selected.team_id,
        userId: user.id,
        playerIds: selectedPlayers,
      });
      await saveEventPlan({
        eventId: selected.id,
        teamId: selected.team_id,
        userId: user.id,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-squad"] });
      queryClient.invalidateQueries({ queryKey: ["event-plan"] });
      toast.success("Matchplaneringen har sparats.");
    },
    onError: () => toast.error("Det gick inte att spara matchplaneringen."),
  });

  const playerList = (players.data ?? []).filter((player) =>
    player.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-4xl px-4 pb-28 pt-6 md:pt-20">
      <h1 className="font-display text-3xl font-bold">Planera match</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Lägg till matchen i lagets kalender och planera vilka spelare som ska vara med.
      </p>

      {view === "start" && (
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
          <button
            type="button"
            onClick={() => setView("plan")}
            className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary"
          >
            <ListChecks className="size-6 text-primary" aria-hidden />
            <h2 className="mt-3 font-display text-xl font-semibold">Planera en match</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Välj match, ta ut spelare och skriv egna anteckningar.
            </p>
          </button>
        </div>
      )}

      {view === "book" && (
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

      {view === "plan" && (
        <section className="mt-6 space-y-6">
          <Button variant="ghost" onClick={() => setView("start")}>
            ← Tillbaka
          </Button>

          <div>
            <h2 className="font-display text-xl font-semibold">Steg 1 – Välj match</h2>
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
                      <p className="font-semibold">{event.title ?? "Match"}</p>
                      <p className="text-sm text-primary">{formatDateTime(event.starts_at)}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.team_name ?? "Lag"}
                        {event.location ? ` · ${event.location}` : ""}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {selected && (
            <>
              <div>
                <h2 className="font-display text-xl font-semibold">Steg 2 – Välj spelare</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Uttagningen ändrar inte närvaro och skickar inga kallelser.
                </p>
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
                    onClick={() => setSelectedPlayers((players.data ?? []).map((player) => player.id))}
                  >
                    Välj alla
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setSelectedPlayers([])}>
                    Avmarkera alla
                  </Button>
                  <span className="text-sm font-semibold">{selectionLabel(selectedPlayers.length)}</span>
                </div>

                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {players.isLoading && <li className="text-sm text-muted-foreground">Hämtar truppen…</li>}
                  {!players.isLoading && playerList.length === 0 && (
                    <li className="text-sm text-muted-foreground">Inga spelare matchar sökningen.</li>
                  )}
                  {playerList.map((player) => {
                    const checked = selectedPlayers.includes(player.id);
                    return (
                      <li key={player.id}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card p-3">
                          <input
                            type="checkbox"
                            className="size-5"
                            checked={checked}
                            onChange={() => setSelectedPlayers((current) => toggleSelection(current, player.id))}
                          />
                          <span className="min-w-0">
                            <span className="block font-semibold">{player.name}</span>
                            {player.number !== null && (
                              <span className="block text-xs text-muted-foreground">Nummer {player.number}</span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>

                <Button variant="outline" className="mt-3" asChild>
                  <Link
                    to="/team/$teamId/event/$eventId"
                    params={{ teamId: selected.team_id, eventId: selected.id }}
                  >
                    Hantera kallelse
                  </Link>
                </Button>
              </div>

              <div>
                <h2 className="font-display text-xl font-semibold">Steg 3 – Sammanställning</h2>
                <div className="mt-3 rounded-xl border border-border bg-card p-4">
                  <p className="font-semibold">{selected.title ?? "Match"}</p>
                  <p className="text-sm text-primary">{formatDateTime(selected.starts_at)}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.team_name ?? "Lag"}
                    {selected.location ? (
                      <span className="ml-1 inline-flex items-center gap-1">
                        <MapPin className="size-3" aria-hidden /> {selected.location}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-2 text-sm font-semibold">{selectionLabel(selectedPlayers.length)}</p>

                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="match-notes">Egna anteckningar</Label>
                    <Textarea
                      id="match-notes"
                      rows={3}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="T.ex. samling 45 minuter före avspark"
                    />
                  </div>

                  <Button className="mt-3" onClick={() => savePlan.mutate()} disabled={savePlan.isPending}>
                    Spara matchplaneringen
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
