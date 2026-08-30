import { useMemo, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarCheck, ChevronRight, Users } from "lucide-react";
import { toast } from "sonner";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_SHORT,
  ATTENDANCE_STATUSES,
  clearAttendance,
  eventLabel,
  fetchEventAttendance,
  fetchTeamAttendance,
  pastEvents,
  registeredCount,
  setAttendance,
  setAttendanceForAll,
  type AttendanceStatus,
} from "@/lib/attendance";
import { fetchEvents, fetchTeamPlayers, formatDateTime } from "@/lib/teams";
import { useTeamRole } from "@/hooks/useTeamRole";
import { Button } from "@/components/ui/button";

type Search = { handelse?: string | undefined; visa?: "alla" | "traning" | "match" | undefined };

export const Route = createFileRoute("/_authenticated/team/$teamId/narvaro")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const visa = search['visa'];
    const handelse = search['handelse'];
    return {
      visa: visa === "traning" || visa === "match" || visa === "alla" ? visa : undefined,
      handelse: typeof handelse === "string" && handelse ? handelse : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Närvaro – registrera träningar och matcher" },
      {
        name: "description",
        content:
          "Registrera närvaro för varje träning och match i lagets kalender och se direkt hur många som deltog.",
      },
      { property: "og:title", content: "Närvaro" },
      { property: "og:description", content: "Klicka på en händelse och pricka av truppen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/narvaro" });
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isCoach, userId } = useTeamRole(teamId);
  const queryClient = useQueryClient();

  const events = useQuery({ queryKey: ["events", teamId], queryFn: () => fetchEvents(teamId) });
  const players = useQuery({ queryKey: ["team-players", teamId], queryFn: () => fetchTeamPlayers(teamId) });
  const attendance = useQuery({
    queryKey: ["attendance", teamId],
    queryFn: () => fetchTeamAttendance(teamId),
  });

  const filter = search.visa ?? "alla";
  const list = useMemo(() => {
    const all = events.data ?? [];
    const done = pastEvents(all)
      .filter((event) => (filter === "alla" ? true : filter === "traning" ? event.type === "training" : event.type === "match"))
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    return done;
  }, [events.data, filter]);

  const selected = (events.data ?? []).find((event) => event.id === search.handelse) ?? null;

  if (selected) {
    return (
      <>
      <Link
        to="/team/$teamId/event/$eventId"
        params={{ teamId, eventId: selected.id }}
        className="mt-4 inline-block text-sm text-primary underline"
      >
        Visa kallelsen och deltagarsvaren
      </Link>
      <EventAttendance
        teamId={teamId}
        userId={userId}
        isCoach={isCoach}
        eventId={selected.id}
        heading={eventLabel(selected)}
        subheading={`${formatDateTime(selected.starts_at)}${selected.location ? ` · ${selected.location}` : ""}`}
        players={(players.data ?? []).map((player) => ({ id: player.id, name: player.name, number: player.number }))}
        onBack={() => navigate({ search: (prev) => ({ ...prev, handelse: undefined }) })}
        onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["attendance", teamId] });
        }}
      />
      </>
    );
  }

  const rows = attendance.data ?? [];

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold">Närvaro</h2>
          <p className="text-sm text-muted-foreground">
            Välj en träning eller match och pricka av truppen. Kommande händelser visas när de har startat.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/team/$teamId/statistik" params={{ teamId }}>
            Statistik
          </Link>
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["alla", "Alla"],
            ["traning", "Träningar"],
            ["match", "Matcher"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => navigate({ search: (prev) => ({ ...prev, visa: value }) })}
            className={`rounded-full border px-3 py-1 text-sm ${
              filter === value ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {events.isLoading && <p className="mt-4 text-sm text-muted-foreground">Laddar kalendern…</p>}

      {!events.isLoading && list.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
          <CalendarCheck className="mx-auto size-8 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            Det finns inga genomförda träningar eller matcher att registrera närvaro på ännu.
          </p>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {list.map((event) => {
          const registered = registeredCount(rows, event.id);
          return (
            <li key={event.id}>
              <Link
                to="/team/$teamId/narvaro"
                params={{ teamId }}
                search={{ visa: filter, handelse: event.id }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
                aria-label={`Registrera närvaro för ${eventLabel(event)}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs tracking-wide text-muted-foreground">
                    {event.type === "training" ? "Träning" : "Match"} · {formatDateTime(event.starts_at)}
                  </p>
                  <p className="font-display text-base font-semibold">{eventLabel(event)}</p>
                  <p className="text-xs text-muted-foreground">
                    {registered > 0
                      ? `${registered} av ${(players.data ?? []).length} spelare registrerade`
                      : "Ingen närvaro registrerad ännu"}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EventAttendance({
  teamId,
  userId,
  isCoach,
  eventId,
  heading,
  subheading,
  players,
  onBack,
  onChanged,
}: {
  teamId: string;
  userId: string | null;
  isCoach: boolean;
  eventId: string;
  heading: string;
  subheading: string;
  players: { id: string; name: string; number: number | null }[];
  onBack: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);

  const rows = useQuery({
    queryKey: ["attendance-event", eventId],
    queryFn: () => fetchEventAttendance(eventId),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance-event", eventId] });
    onChanged();
  };

  const save = useMutation({
    mutationFn: async (input: { playerId: string; status: AttendanceStatus; current: AttendanceStatus | null }) => {
      if (!userId) throw new Error("Du måste vara inloggad.");
      if (input.current === input.status) {
        await clearAttendance(eventId, input.playerId);
        return;
      }
      await setAttendance({ eventId, teamId, playerId: input.playerId, userId, status: input.status });
    },
    onSuccess: refresh,
    onError: () => toast.error("Det gick inte att spara närvaron."),
    onSettled: () => setPending(null),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Du måste vara inloggad.");
      await setAttendanceForAll({
        eventId,
        teamId,
        userId,
        playerIds: players.map((player) => player.id),
        status: "present",
      });
    },
    onSuccess: () => {
      refresh();
      toast.success("Alla spelare är markerade som närvarande.");
    },
    onError: () => toast.error("Det gick inte att markera alla spelare."),
  });

  const statusFor = (playerId: string): AttendanceStatus | null =>
    (rows.data ?? []).find((row) => row.player_id === playerId)?.status ?? null;

  const present = (rows.data ?? []).filter((row) => row.status === "present" || row.status === "late").length;

  return (
    <section className="mt-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Tillbaka till närvarolistan" onClick={onBack}>
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-bold">{heading}</h2>
          <p className="text-xs text-muted-foreground">{subheading}</p>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {present} av {players.length} spelare deltog.
      </p>

      {isCoach && players.length > 0 && (
        <Button
          className="mt-3"
          variant="outline"
          size="sm"
          disabled={markAll.isPending}
          aria-label="Markera alla spelare som närvarande"
          onClick={() => markAll.mutate()}
        >
          <Users className="size-4" /> Markera alla som närvarande
        </Button>
      )}

      {players.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Laget har inga spelare i truppen ännu.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {players.map((player) => {
          const current = statusFor(player.id);
          return (
            <li key={player.id} className="rounded-xl border border-border bg-card p-3">
              <p className="font-display text-base font-semibold">
                {player.number != null ? `${player.number}. ` : ""}
                {player.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {current ? ATTENDANCE_LABELS[current] : "Ingen närvaro registrerad"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ATTENDANCE_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={!isCoach || (save.isPending && pending === player.id)}
                    aria-pressed={current === status}
                    aria-label={`${ATTENDANCE_LABELS[status]} för ${player.name}`}
                    onClick={() => {
                      setPending(player.id);
                      save.mutate({ playerId: player.id, status, current });
                    }}
                    className={`rounded-full border px-3 py-1 text-sm disabled:opacity-60 ${
                      current === status
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {ATTENDANCE_SHORT[status]}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      {!isCoach && (
        <p className="mt-4 text-xs text-muted-foreground">
          Endast lagets tränare kan ändra närvaron. Du ser registreringen som den är sparad.
        </p>
      )}
    </section>
  );
}
