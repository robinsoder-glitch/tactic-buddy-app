import { Link } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, MapPin, Send } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";
import { fetchEvents, formatDateTime } from "@/lib/teams";
import { fetchTeamInviteCounts, inviteStateText, isCoachMembership } from "@/lib/invitations";
import { eventDisplayTitle } from "@/lib/event-labels";
import { Button } from "@/components/ui/button";

/**
 * Tränarens kallelsevy: alla kommande matcher i lagen med läge på kallelsen
 * och en knapp som leder direkt till utskicket.
 */
export function CoachInvites() {
  const { memberships, loading } = useAccount();
  // Bara godkända ledarroller – en spelare i laget ska inte se utskicksvyn.
  const teams = memberships.filter(isCoachMembership);

  const results = useQueries({
    queries: teams.map((item) => ({
      queryKey: ["coach-invites", item.team_id],
      queryFn: async () => {
        const [events, counts] = await Promise.all([
          fetchEvents(item.team_id, "match"),
          fetchTeamInviteCounts(item.team_id),
        ]);
        return {
          teamId: item.team_id,
          teamName: item.team?.name ?? "Laget",
          counts,
          events,
        };
      },
    })),
  });

  const busy = loading || results.some((result) => result.isLoading);
  const now = Date.now();
  const rows = results
    .flatMap((result) => {
      const data = result.data;
      if (!data) return [];
      return data.events
        .filter(
          (event) => !event.cancelled_at && new Date(event.starts_at).getTime() >= now - 3600_000,
        )
        .map((event) => ({
          teamId: data.teamId,
          teamName: data.teamName,
          event,
          count: data.counts[event.id],
        }));
    })
    .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-8 md:pt-20">
      <h1 className="font-display text-3xl font-bold">Kallelser</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kallelser går aldrig ut automatiskt – du väljer när de skickas, och de går bara till
        spelarna. Träningar har ingen kallelse, där registrerar du närvaro efteråt.
      </p>

      {busy && <p className="mt-6 text-sm text-muted-foreground">Hämtar matcher …</p>}

      {!busy && rows.length === 0 && (
        <div className="mt-6 space-y-3 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <p>Det finns inga kommande matcher att kalla till.</p>
          <Button asChild size="sm">
            <Link to="/planera-match">Planera en match</Link>
          </Button>
        </div>
      )}

      <ul className="mt-5 space-y-3">
        {rows.map((row) => {
          const sent = (row.count?.total ?? 0) > 0;
          const done = sent && row.count!.answered === row.count!.total;
          return (
            <li key={row.event.id} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Match · {row.teamName}</p>
              <h2 className="font-display text-xl font-semibold">{eventDisplayTitle(row.event)}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-4" aria-hidden />
                  {formatDateTime(row.event.starts_at)}
                </span>
                {row.event.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-4" aria-hidden />
                    {row.event.location}
                  </span>
                )}
              </p>
              <p
                className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  done
                    ? "bg-primary/15 text-primary"
                    : sent
                      ? "bg-muted text-foreground"
                      : "bg-destructive/15 text-destructive"
                }`}
              >
                {done ? (
                  <CheckCircle2 className="size-3.5" aria-hidden />
                ) : (
                  <Send className="size-3.5" aria-hidden />
                )}
                {inviteStateText(row.count)}
              </p>
              <div className="mt-3">
                <Button size="sm" variant={sent ? "outline" : "default"} asChild>
                  <Link
                    to="/team/$teamId/event/$eventId"
                    params={{ teamId: row.teamId, eventId: row.event.id }}
                  >
                    {sent ? "Hantera kallelsen" : "Skicka kallelse"}
                  </Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
