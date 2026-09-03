import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { CalendarCheck, CheckCircle2, ChevronRight, CircleAlert } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";
import { CoachOnly } from "@/components/CoachOnly";
import { eventLabel, fetchTeamAttendance, pastEvents, registeredCount } from "@/lib/attendance";
import { fetchEvents, fetchTeamPlayers, formatDateTime } from "@/lib/teams";

export const Route = createFileRoute("/_authenticated/narvaro")({
  head: () => ({
    meta: [
      { title: "Närvaro – genomförda träningar och matcher" },
      {
        name: "description",
        content: "Pricka av truppen efter varje genomförd träning och match och se vad som är klart.",
      },
      { property: "og:title", content: "Närvaro" },
      {
        property: "og:description",
        content: "Registrera närvaro för lagets genomförda träningar och matcher.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <CoachOnly>
      <NarvaroPage />
    </CoachOnly>
  ),
});

function NarvaroPage() {
  const { memberships, loading } = useAccount();
  const teams = memberships.filter((item) => item.status === "approved");

  const results = useQueries({
    queries: teams.map((item) => ({
      queryKey: ["narvaro-overview", item.team_id],
      queryFn: async () => {
        const [events, players, rows] = await Promise.all([
          fetchEvents(item.team_id),
          fetchTeamPlayers(item.team_id),
          fetchTeamAttendance(item.team_id),
        ]);
        return {
          teamId: item.team_id,
          teamName: item.team?.name ?? "Laget",
          players: players.length,
          rows,
          events: pastEvents(events).sort((a, b) => b.starts_at.localeCompare(a.starts_at)),
        };
      },
    })),
  });

  const busy = loading || results.some((result) => result.isLoading);
  const list = results
    .flatMap((result) =>
      (result.data?.events ?? []).map((event) => ({
        event,
        teamId: result.data!.teamId,
        teamName: result.data!.teamName,
        players: result.data!.players,
        registered: registeredCount(result.data!.rows, event.id),
      })),
    )
    .sort((a, b) => b.event.starts_at.localeCompare(a.event.starts_at));

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 md:pt-20">
      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold">
          <CalendarCheck className="size-6 text-primary" aria-hidden /> Närvaro
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Här listas bara genomförda träningar och matcher. Öppna en aktivitet, pricka av hela
          truppen och tryck på Färdigställ närvaro.
        </p>
      </header>

      {busy && <p className="mt-6 text-sm text-muted-foreground">Laddar …</p>}

      {!busy && teams.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Du är inte med i något lag ännu.
          <Link to="/teams" className="mt-3 block text-primary underline-offset-4 hover:underline">
            Till Mina lag
          </Link>
        </div>
      )}

      {!busy && teams.length > 0 && list.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Inga genomförda träningar eller matcher ännu.
        </div>
      )}

      <ul className="mt-6 space-y-2">
        {list.map((item) => {
          const done = item.players > 0 && item.registered >= item.players;
          return (
            <li key={item.event.id}>
              <Link
                to="/team/$teamId/narvaro"
                params={{ teamId: item.teamId }}
                search={{ visa: "alla" as const, handelse: item.event.id }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs tracking-wide text-muted-foreground">
                    {item.event.type === "training" ? "Träning" : "Match"} · {item.teamName} ·{" "}
                    {formatDateTime(item.event.starts_at)}
                  </p>
                  <p className="font-display text-base font-semibold">{eventLabel(item.event)}</p>
                  <p
                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      done
                        ? "bg-primary/15 text-primary"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="size-3.5" aria-hidden />
                    ) : (
                      <CircleAlert className="size-3.5" aria-hidden />
                    )}
                    {done
                      ? "Klart"
                      : `Ej klart – ${item.registered} av ${item.players} registrerade`}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
