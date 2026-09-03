import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PlanStatusBadge } from "@/components/PlanStatusBadge";
import { EventManager } from "@/components/EventManager";
import { EventCoaches } from "@/components/EventCoaches";
import { LineupPitch, type LineupPlayerInfo } from "@/components/LineupPitch";
import { MatchLineupEditor } from "@/components/MatchLineupEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchUpcomingEvents, type PlannableEvent } from "@/lib/event-planning";
import { planStatus } from "@/lib/plan-status";
import { fetchEventPlans, fetchSquad, fetchSquads } from "@/lib/planning";
import { fetchEventCoaches } from "@/lib/event-coaches";
import { useAccount } from "@/hooks/useAccount";
import {
  fetchTeam,
  fetchTeamMembers,
  fetchTeamPlayers,
  formatDateTime,
  type Team,
  type TeamMember,
  type TeamPlayer,
} from "@/lib/teams";
import {
  fetchEventInvitations,
  inviteStatusLabel,
  summaryText,
  countInvitations,
  type Invitation,
  type InviteStatus,
} from "@/lib/invitations";
import { fetchTactics, type TacticSummary } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import {
  FORMAT_LABELS,
  FORMAT_PLAYERS,
  createMatchShare,
  defaultSlots,
  fetchLineup,
  fetchMatchShare,
  lineupStarters,
  revokeMatchShare,
  saveMatchPlanFull,
  sortPlayersByResponse,
  syncLineupWithSquad,
  validateMatchPlan,
  validateMeetBeforeStart,
  type LineupSlot,
  type MatchShare,
} from "@/lib/match-plan";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Pencil,
  Share2,
  Trash2,
  Users,
} from "lucide-react";

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString("sv-SE", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
function timeOnly(value: string): string {
  return new Date(value).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}
import { toast } from "sonner";
import { CoachOnly } from "@/components/CoachOnly";

export const Route = createFileRoute("/_authenticated/planera-match")({
  head: () => ({
    meta: [
      { title: "Planera match – Fotbollsrummet" },
      {
        name: "description",
        content: "Planera matcher: spelare, ledare, formation, laguppställning och anteckningar.",
      },
    ],
  }),
  component: () => (
    <CoachOnly>
      <MatchPlanningPage />
    </CoachOnly>
  ),
});

type MatchEvent = PlannableEvent & {
  meet_at?: string | null;
  ends_at?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  match_kind?: string | null;
  match_duration_minutes?: number | null;
};

const STEPS = ["Matchuppgifter", "Ledare", "Spelare", "Formation", "Granska"] as const;

function MatchPlanningPage() {
  const search = Route.useSearch() as { eventId?: string; edit?: string };
  const [events, setEvents] = useState<PlannableEvent[] | null>(null);
  const [planDone, setPlanDone] = useState<Map<string, boolean>>(new Map());
  const [squadCounts, setSquadCounts] = useState<Map<string, number>>(new Map());
  const [coachCounts, setCoachCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [eventId, setEventId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const list = await fetchUpcomingEvents();
        const matches = list.filter((e) => e.type === "match");
        setEvents(matches);
        const ids = matches.map((e) => e.id);
        const [plans, squads, coaches] = await Promise.all([
          fetchEventPlans(ids),
          fetchSquads(ids),
          fetchEventCoaches(ids),
        ]);
        setPlanDone(new Map(plans.filter((p) => p.planning_done).map((p) => [p.event_id, true])));
        const sc = new Map<string, number>();
        squads.forEach((s) => sc.set(s.event_id, (sc.get(s.event_id) ?? 0) + 1));
        setSquadCounts(sc);
        const cc = new Map<string, number>();
        coaches.forEach((c) => cc.set(c.event_id, (cc.get(c.event_id) ?? 0) + 1));
        setCoachCounts(cc);
        if (search.eventId && ids.includes(search.eventId)) setEventId(search.eventId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Kunde inte hämta matcher");
      } finally {
        setLoading(false);
      }
    })();
  }, [search.eventId, reloadKey]);


  const selected = events?.find((e) => e.id === eventId) ?? null;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
        {!selected && (
          <>
            <div className="space-y-1">
              <h1 className="font-display text-3xl font-bold">Planera match</h1>
              <p className="text-sm text-muted-foreground">
                Välj en match och gör den klar: uppgifter, ledare, spelare och laguppställning.
              </p>
            </div>
            <NewMatchCreator />
            {loading && <p className="text-sm text-muted-foreground">Hämtar matcher…</p>}
            {!loading && (events?.length ?? 0) === 0 && (
              <p className="text-sm text-muted-foreground">
                Inga kommande matcher. Skapa en match ovan.
              </p>
            )}
            <ul className="space-y-3">
              {(events ?? []).map((event) => {
                const status = planStatus({
                  type: "match",
                  planSaved: planDone.get(event.id) ?? false,
                  playerCount: squadCounts.get(event.id) ?? 0,
                  coachCount: coachCounts.get(event.id) ?? 0,
                });
                return (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => setEventId(event.id)}
                      className="w-full rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium">{event.title ?? "Match"}</p>
                          <p className="text-sm text-muted-foreground">
                            {event.team_name} · {formatDateTime(event.starts_at)}
                          </p>
                        </div>
                        <PlanStatusBadge status={status} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {selected && (
          <MatchPlanner
            key={selected.id}
            eventId={selected.id}
            teamId={selected.team_id}
            startInEdit={search.edit === "1" || !(planDone.get(selected.id) ?? false)}
            onClose={() => setEventId(null)}
            onSaved={(id, counts) => {
              setPlanDone((m) => new Map(m).set(id, true));
              setSquadCounts((m) => new Map(m).set(id, counts.players));
              setCoachCounts((m) => new Map(m).set(id, counts.coaches));
              if (counts.event) {
                setEvents((list) =>
                  (list ?? []).map((item) =>
                    item.id === id ? { ...item, ...counts.event } : item,
                  ),
                );
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

function MatchPlanner({
  eventId,
  teamId,
  startInEdit,
  onClose,
  onSaved,
}: {
  eventId: string;
  teamId: string;
  startInEdit: boolean;
  onClose: () => void;
  onSaved: (
    eventId: string,
    counts: { players: number; coaches: number; event?: Partial<PlannableEvent> },
  ) => void;
}) {
  const [mode, setMode] = useState<"read" | "edit">(startInEdit ? "edit" : "read");
  const [planSaved, setPlanSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState<MatchEvent | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [coaches, setCoaches] = useState<TeamMember[]>([]);
  const [players, setPlayers] = useState<TeamPlayer[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [tactics, setTactics] = useState<TacticSummary[]>([]);
  const [share, setShare] = useState<MatchShare | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Redigeringsläge
  const [step, setStep] = useState(0);
  const [opponent, setOpponent] = useState("");
  const [homeAway, setHomeAway] = useState<"hemma" | "borta">("hemma");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [meetTime, setMeetTime] = useState("");
  const [meetInfo, setMeetInfo] = useState("");
  const [coachIds, setCoachIds] = useState<string[]>([]);
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [format, setFormat] = useState("7v7");
  const [slots, setSlots] = useState<LineupSlot[]>([]);
  const [bench, setBench] = useState<string[]>([]);
  const [tacticId, setTacticId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const statusByPlayer = useMemo(() => {
    const map = new Map<string, InviteStatus>();
    invitations.forEach((inv) => map.set(inv.player_id, inv.status));
    return map;
  }, [invitations]);

  const playersById = useMemo(() => {
    const map = new Map<string, LineupPlayerInfo>();
    players.forEach((p) => map.set(p.id, { name: p.name, number: p.number }));
    return map;
  }, [players]);

  // Summering över de uttagna spelarna: spelare utan kallelserad räknas som Ej svarat.
  const displayCounts = useMemo(
    () =>
      countInvitations(
        playerIds.map((id) => ({
          status: invitations.find((i) => i.player_id === id)?.status ?? "pending",
        })),
      ),
    [playerIds, invitations],
  );

  useEffect(() => {
    void (async () => {
      try {
        const [{ data: ev }, t, members, pls, invs, squad, evCoaches, lineup, tacts, shr] =
          await Promise.all([
            supabase.from("events").select("*").eq("id", eventId).single(),
            fetchTeam(teamId),
            fetchTeamMembers(teamId),
            fetchTeamPlayers(teamId),
            fetchEventInvitations(eventId),
            (await import("@/lib/planning")).fetchSquad(eventId),
            fetchEventCoaches([eventId]),
            fetchLineup(eventId),
            fetchTactics(),
            fetchMatchShare(eventId),
          ]);
        if (!ev) throw new Error("Matchen hittades inte.");
        setEvent(ev as unknown as MatchEvent);
        setTeam(t);
        setCoaches(
          members.filter(
            (m) => m.status === "approved" && m.role !== "guardian" && m.role !== "player",
          ),
        );
        setPlayers(pls.filter((p) => (p as { is_active?: boolean }).is_active !== false));
        setInvitations(invs);
        setTactics(tacts);
        setShare(shr && !shr.revoked_at ? shr : null);

        // Förifyll redigeringsläget
        setOpponent(
          (ev.away_team && ev.home_team === t.name
            ? ev.away_team
            : ev.home_team && ev.home_team !== t.name
              ? ev.home_team
              : ev.away_team) ?? "",
        );
        setHomeAway(ev.home_team === t.name ? "hemma" : "borta");
        setLocation(ev.location ?? "");
        const start = new Date(ev.starts_at);
        setDate(start.toISOString().slice(0, 10));
        setStartTime(ev.starts_at ? timeOnly(ev.starts_at) : "");
        setEndTime(ev.ends_at ? timeOnly(ev.ends_at) : "");
        setMeetTime(ev.meet_at ? timeOnly(ev.meet_at) : "");
        setMeetInfo("");
        setCoachIds(evCoaches.map((c) => c.user_id));
        setPlayerIds(squad);
        if (lineup) {
          setSlots(lineup.slots);
          setBench(lineup.bench);
          setTacticId(lineup.tactic_id);
          const match = lineup.formation.match(/^(\d+v\d+)/);
          setFormat(match?.[1] ?? "7v7");
        } else {
          const def = defaultSlots(format);
          setSlots(def);
          setBench(squad);
        }
        const { data: plan } = await supabase
          .from("event_plans")
          .select("notes, planning_done")
          .eq("event_id", eventId)
          .maybeSingle();
        setMeetInfo(plan?.notes ?? "");
        setPlanSaved(Boolean(plan?.planning_done));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Kunde inte hämta matchen");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, teamId]);

  function changeFormat(next: string) {
    setFormat(next);
    const def = defaultSlots(next);
    // Behåll spelare på första positionerna i samma ordning som tidigare.
    const current = lineupStarters(slots);
    const placed = def.map((s, i) => ({ ...s, player_id: current[i] ?? null }));
    const leftovers = current.slice(def.length);
    const synced = syncLineupWithSquad(placed, playerIds);
    setSlots(synced.slots);
    setBench([...new Set([...synced.bench, ...leftovers.filter((id) => playerIds.includes(id))])]);
  }

  function togglePlayer(id: string) {
    if (playerIds.includes(id)) {
      const {
        slots: ns,
        bench: nb,
        removedFromPitch,
      } = syncLineupWithSquad(
        slots,
        playerIds.filter((p) => p !== id),
      );
      if (removedFromPitch.length > 0) {
        toast.warning(
          `${playersById.get(id)?.name ?? "Spelaren"} låg på planen – platsen blir Tom plats.`,
        );
      }
      setPlayerIds(playerIds.filter((p) => p !== id));
      setSlots(ns);
      setBench(nb);
    } else {
      if (statusByPlayer.get(id) === "declined") {
        const ok = window.confirm(
          "Spelaren har svarat att den inte kan delta. Vill du ändå ta ut spelaren?",
        );
        if (!ok) return;
      }
      setPlayerIds([...playerIds, id]);
      setBench((b) => [...b, id]);
    }
  }

  async function saveAll() {
    if (!event || !team) return;
    const meetIso = meetTime ? new Date(`${date}T${meetTime}`).toISOString() : null;
    const startIso = new Date(`${date}T${startTime}`).toISOString();
    const meetError = validateMeetBeforeStart(meetIso, startIso);
    if (meetError) {
      toast.error(meetError);
      setStep(0);
      return;
    }
    const requiredCount = FORMAT_PLAYERS[format] ?? 0;
    const planError = validateMatchPlan({
      playerIds,
      coachIds,
      slots,
      bench,
      required: requiredCount,
    });
    let effectiveRequired = requiredCount;
    if (planError) {
      const isFewPlayers =
        planError.startsWith("Välj minst en spelare") ||
        planError.startsWith("Det måste vara exakt");
      if (!isFewPlayers) {
        toast.error(planError);
        return;
      }
      const ok = window.confirm(
        `Varning: ${planError}\n\nVill du spara ändå? Du kan komplettera med fler spelare senare.`,
      );
      if (!ok) return;
      const hardError = validateMatchPlan({
        playerIds,
        coachIds,
        slots,
        bench,
        required: requiredCount,
        allowFewPlayers: true,
      });
      if (hardError) {
        toast.error(hardError);
        return;
      }
      effectiveRequired = 0;
      toast.warning("Matchplanen sparas med för få spelare.");
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("events")
        .update({
          location: location.trim() || null,
          starts_at: startIso,
          ends_at: endTime ? new Date(`${date}T${endTime}`).toISOString() : null,
          meet_at: meetIso,
          home_team: homeAway === "hemma" ? team.name : opponent.trim() || null,
          away_team: homeAway === "hemma" ? opponent.trim() || null : team.name,
        })
        .eq("id", eventId);
      if (error) throw error;
      await saveMatchPlanFull({
        eventId,
        teamId,
        notes: meetInfo,
        playerIds,
        coachIds,
        formation: `${format} (${FORMAT_LABELS[format]})`,
        slots,
        bench,
        tacticId,
        required: effectiveRequired,
      });
      toast.success("Matchplanen är sparad");
      // Läsläget ska visa de nyss sparade uppgifterna utan omladdning.
      const [{ data: freshEvent }, lineup, freshCoaches, freshSquad, freshPlan] = await Promise.all(
        [
          supabase.from("events").select("*").eq("id", eventId).single(),
          fetchLineup(eventId),
          fetchEventCoaches([eventId]),
          (await import("@/lib/planning")).fetchSquad(eventId),
          supabase
            .from("event_plans")
            .select("notes, planning_done")
            .eq("event_id", eventId)
            .maybeSingle(),
        ],
      );
      if (freshEvent) setEvent(freshEvent as unknown as MatchEvent);
      if (lineup) {
        setSlots(lineup.slots);
        setBench(lineup.bench);
        setTacticId(lineup.tactic_id);
      }
      setCoachIds(freshCoaches.map((c) => c.user_id));
      setPlayerIds(freshSquad);
      setMeetInfo(freshPlan.data?.notes ?? "");
      setPlanSaved(Boolean(freshPlan.data?.planning_done));
      onSaved(eventId, {
        players: freshSquad.length,
        coaches: freshCoaches.length,
        ...(freshEvent
          ? {
              event: {
                starts_at: freshEvent.starts_at,
                title: freshEvent.title,
              } as Partial<PlannableEvent>,
            }
          : {}),
      });
      setMode("read");
      // Tillbaka till matchlistan så att man ser den uppdaterade statusen.
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunde inte spara matchplanen");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Hämtar matchen…</p>;
  if (!event || !team) return null;

  const sortedPlayers = sortPlayersByResponse(players, statusByPlayer);
  const starters = lineupStarters(slots);
  const required = FORMAT_PLAYERS[format] ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="size-4" /> Alla matcher
        </Button>
        {mode === "read" ? (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
              <Share2 className="size-4" /> Dela laguppställning
            </Button>
            <Button size="sm" onClick={() => setMode("edit")}>
              <Pencil className="size-4" /> Ändra planering
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMode(startInEdit ? "edit" : "read")}
            disabled={startInEdit}
          >
            Avbryt
          </Button>
        )}
      </div>

      {mode === "read" ? (
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <h1 className="text-lg font-semibold">
                {event.home_team && event.away_team
                  ? `${event.home_team} – ${event.away_team}`
                  : (event.title ?? "Match")}
              </h1>
              <PlanStatusBadge
                status={planStatus({
                  type: "match",
                  planSaved,
                  playerCount: playerIds.length,
                  coachCount: coachIds.length,
                })}
              />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Hemma/borta</dt>
                <dd>{event.home_team === team.name ? "Hemma" : "Borta"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Plats</dt>
                <dd>{event.location ?? "–"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Datum</dt>
                <dd>{dateLabel(event.starts_at)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Matchstart</dt>
                <dd>{timeOnly(event.starts_at)}</dd>
              </div>
              {event.meet_at && (
                <div>
                  <dt className="text-muted-foreground">Samling</dt>
                  <dd>{timeOnly(event.meet_at)}</dd>
                </div>
              )}
              {event.match_kind && (
                <div>
                  <dt className="text-muted-foreground">Matchtyp</dt>
                  <dd>{event.match_kind}</dd>
                </div>
              )}
            </dl>
            {meetInfo && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">{meetInfo}</p>}
          </div>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-2 flex items-center gap-2 font-medium">
              <Users className="size-4" /> Ledare
            </h2>
            <EventCoaches eventId={eventId} teamId={teamId} userId={null} canEdit={false} />
          </section>

          <section className="rounded-xl border bg-card p-4">
            <h2 className="mb-2 font-medium">Spelarnas svar</h2>
            <p className="text-sm text-muted-foreground">{summaryText(displayCounts)}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {sortedPlayers
                .filter((p) => playerIds.includes(p.id))
                .map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span>
                      {p.number != null && (
                        <span className="mr-1 text-muted-foreground">{p.number}</span>
                      )}
                      {p.name}
                    </span>
                    <span className="text-muted-foreground">
                      {inviteStatusLabel(statusByPlayer.get(p.id) ?? "pending")}
                    </span>
                  </li>
                ))}
            </ul>
          </section>

          <section className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="font-medium">Laguppställning</h2>
            <LineupPitch slots={slots} players={playersById} />
            {bench.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Avbytare: {bench.map((id) => playersById.get(id)?.name ?? "Okänd").join(", ")}
              </p>
            )}
            {tacticId && (
              <Button asChild variant="outline" size="sm">
                <Link to="/taktik" search={{ open: tacticId }}>
                  <ClipboardList className="size-4" /> Öppna kopplad taktik
                </Link>
              </Button>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-5">
          <ol className="flex flex-wrap gap-2">
            {STEPS.map((label, i) => (
              <li
                key={label}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  i === step
                    ? "bg-primary text-primary-foreground"
                    : i < step
                      ? "bg-primary/15"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}. {label}
              </li>
            ))}
          </ol>

          {step === 0 && (
            <section className="space-y-4 rounded-xl border bg-card p-4">
              <h2 className="font-medium">Matchuppgifter</h2>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="mp-opponent">
                  Motståndare
                </label>
                <Input
                  id="mp-opponent"
                  value={opponent}
                  onChange={(e) => setOpponent(e.target.value)}
                  placeholder="T.ex. IK Exempel"
                />
              </div>
              <div className="flex gap-2" role="radiogroup" aria-label="Hemma eller borta">
                {(["hemma", "borta"] as const).map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={homeAway === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHomeAway(v)}
                  >
                    {v === "hemma" ? "Hemma" : "Borta"}
                  </Button>
                ))}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="mp-location">
                  Arena/plats
                </label>
                <Input
                  id="mp-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="mp-date">
                    Datum
                  </label>
                  <Input
                    id="mp-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="mp-start">
                    Matchstart
                  </label>
                  <Input
                    id="mp-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="mp-meet">
                    Samlingstid
                  </label>
                  <Input
                    id="mp-meet"
                    type="time"
                    value={meetTime}
                    onChange={(e) => setMeetTime(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="mp-end">
                    Beräknad sluttid
                  </label>
                  <Input
                    id="mp-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="mp-meetinfo">
                  Samlingsinformation (frivilligt)
                </label>
                <Textarea
                  id="mp-meetinfo"
                  value={meetInfo}
                  onChange={(e) => setMeetInfo(e.target.value)}
                  rows={2}
                  placeholder="T.ex. samling vid omklädningsrummen"
                />
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-3 rounded-xl border bg-card p-4">
              <h2 className="font-medium">Ansvariga ledare</h2>
              <p className="text-sm text-muted-foreground">
                Minst en ledare krävs för status Klar.
              </p>
              <ul className="space-y-2">
                {coaches.map((m) => {
                  const checked = coachIds.includes(m.user_id);
                  const toggle = () =>
                    setCoachIds((ids) =>
                      ids.includes(m.user_id)
                        ? ids.filter((x) => x !== m.user_id)
                        : [...ids, m.user_id],
                    );
                  return (
                    <li key={m.user_id}>
                      <div
                        role="checkbox"
                        aria-checked={checked}
                        tabIndex={0}
                        onClick={toggle}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            toggle();
                          }
                        }}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-accent/40"
                      >
                        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={toggle}
                            tabIndex={-1}
                            aria-hidden
                          />
                        </span>
                        <span className="flex-1 font-medium">{m.displayName ?? "Ledare"}</span>
                        <span className="text-xs text-muted-foreground">
                          {m.role === "head_coach"
                            ? "Huvudtränare"
                            : m.role === "club_admin"
                              ? "Klubbadmin"
                              : "Tränare"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-3 rounded-xl border bg-card p-4">
              <h2 className="font-medium">Uttagna spelare</h2>
              <p className="text-sm text-muted-foreground">
                {playerIds.length} valda · {required} startspelare krävs för {FORMAT_LABELS[format]}
                .
              </p>
              <ul className="space-y-2">
                {sortedPlayers.map((p) => {
                  const st = statusByPlayer.get(p.id) ?? "pending";
                  const checked = playerIds.includes(p.id);
                  return (
                    <li key={p.id}>
                      <div
                        role="checkbox"
                        aria-checked={checked}
                        tabIndex={0}
                        onClick={() => togglePlayer(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            togglePlayer(p.id);
                          }
                        }}
                        className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-accent/40"
                      >
                        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePlayer(p.id)}
                            tabIndex={-1}
                            aria-hidden
                          />
                        </span>
                        <span className="flex-1 font-medium">
                          {p.number != null && (
                            <span className="mr-1 text-muted-foreground">{p.number}</span>
                          )}
                          {p.name}
                        </span>
                        <span
                          className={`text-xs ${st === "declined" ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {inviteStatusLabel(st)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {step === 3 && (
            <section className="space-y-4 rounded-xl border bg-card p-4">
              <h2 className="font-medium">Formation och avbytare</h2>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Spelform">
                {Object.keys(FORMAT_PLAYERS).map((f) => (
                  <Button
                    key={f}
                    type="button"
                    variant={format === f ? "default" : "outline"}
                    size="sm"
                    onClick={() => changeFormat(f)}
                  >
                    {FORMAT_LABELS[f]}
                  </Button>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Startspelare: {starters.length}/{required}
              </p>
              <MatchLineupEditor
                slots={slots}
                bench={bench}
                players={playersById}
                onChange={(s, b) => {
                  setSlots(s);
                  setBench(b);
                }}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="mp-tactic">
                  Kopplad taktik (frivilligt)
                </label>
                <select
                  id="mp-tactic"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={tacticId ?? ""}
                  onChange={(e) => setTacticId(e.target.value || null)}
                >
                  <option value="">Ingen taktik</option>
                  {tactics.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-3 rounded-xl border bg-card p-4">
              <h2 className="font-medium">Granska och spara</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Motståndare</dt>
                  <dd>{opponent || "–"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Hemma/borta</dt>
                  <dd>{homeAway === "hemma" ? "Hemma" : "Borta"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Plats</dt>
                  <dd>{location || "–"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Datum</dt>
                  <dd>{date}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Matchstart</dt>
                  <dd>{startTime}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Samling</dt>
                  <dd>{meetTime || "–"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ledare</dt>
                  <dd>{coachIds.length} valda</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Spelare</dt>
                  <dd>{playerIds.length} uttagna</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Spelform</dt>
                  <dd>{FORMAT_LABELS[format]}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Startspelare</dt>
                  <dd>
                    {starters.length}/{required}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Avbytare</dt>
                  <dd>{bench.length}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Taktik</dt>
                  <dd>{tactics.find((t) => t.id === tacticId)?.name ?? "Ingen"}</dd>
                </div>
              </dl>
              <LineupPitch slots={slots} players={playersById} />
            </section>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="size-4" /> Föregående
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => {
                  if (step === 0) {
                    if (!opponent.trim()) {
                      toast.error("Ange motståndare.");
                      return;
                    }
                    if (!date || !startTime) {
                      toast.error("Ange datum och matchstart.");
                      return;
                    }
                    if (meetTime) {
                      const err = validateMeetBeforeStart(
                        new Date(`${date}T${meetTime}`).toISOString(),
                        new Date(`${date}T${startTime}`).toISOString(),
                      );
                      if (err) {
                        toast.error(err);
                        return;
                      }
                    }
                  }
                  if (step === 1 && coachIds.length === 0) {
                    toast.error("Välj minst en ledare.");
                    return;
                  }
                  if (step === 2 && playerIds.length === 0) {
                    toast.error("Välj minst en spelare.");
                    return;
                  }
                  setStep((s) => s + 1);
                }}
              >
                Nästa <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={() => void saveAll()} disabled={saving}>
                <Check className="size-4" /> {saving ? "Sparar…" : "Spara matchplan"}
              </Button>
            )}
          </div>
        </div>
      )}

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        eventId={eventId}
        teamId={teamId}
        share={share}
        onChange={setShare}
      />
    </div>
  );
}

function ShareDialog({
  open,
  onOpenChange,
  eventId,
  teamId,
  share,
  onChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  teamId: string;
  share: MatchShare | null;
  onChange: (share: MatchShare | null) => void;
}) {
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const url = share ? `${window.location.origin}/delad-match/${share.token}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dela laguppställning</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Länken är skrivskyddad och visar bara matchinfo, formation, tröjnummer och namn – aldrig
          kontaktuppgifter eller anteckningar.
        </p>
        {share ? (
          <div className="space-y-3">
            <Input readOnly value={url ?? ""} onFocus={(e) => e.target.select()} />
            {share.expires_at && (
              <p className="text-xs text-muted-foreground">
                Slutar gälla: {dateLabel(share.expires_at)}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard?.writeText(url ?? "");
                  toast.success("Länken är kopierad");
                }}
              >
                Kopiera länk
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      await revokeMatchShare(share.id);
                      onChange(null);
                      toast.success("Delningslänken är återkallad");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Kunde inte återkalla länken");
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                <Trash2 className="size-4" /> Återkalla
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="share-expires">
                Slutdatum (frivilligt)
              </label>
              <Input
                id="share-expires"
                type="date"
                value={expires}
                onChange={(e) => setExpires(e.target.value)}
              />
            </div>
            <Button
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const created = await createMatchShare({
                      eventId,
                      teamId,
                      expiresAt: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
                    });
                    onChange(created);
                    toast.success("Delningslänken är skapad");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Kunde inte skapa länken");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              <Share2 className="size-4" /> Skapa länk
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NewMatchCreator({ onChanged }: { onChanged?: () => void }) {
  const { user, memberships, loading } = useAccount();

  const coachTeams = memberships.filter(
    (m) =>
      m.status === "approved" && ["coach", "head_coach", "club_admin"].includes(m.role as string),
  );
  const [teamId, setTeamId] = useState("");
  const activeTeam = teamId || coachTeams[0]?.team_id || "";

  if (loading) return null;
  if (coachTeams.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Du behöver vara tränare i ett lag för att skapa matcher.
      </p>
    );
  }
  return (
    <section className="space-y-3">
      {coachTeams.length > 1 && (
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={activeTeam}
          onChange={(e) => setTeamId(e.target.value)}
          aria-label="Välj lag"
        >
          {coachTeams.map((m) => (
            <option key={m.team_id} value={m.team_id}>
              {m.team?.name ?? "Lag"}
            </option>
          ))}
        </select>
      )}
      {activeTeam && (
        <EventManager
          teamId={activeTeam}
          userId={user?.id ?? null}
          isCoach
          type="match"
          title="Matchtillfällen"
          newLabel="Boka match"
          hideList
          onChanged={() => setReloadKey((n) => n + 1)}
          savedMessage="Matchen har lagts till i kalendern."
        />

      )}
    </section>
  );
}
