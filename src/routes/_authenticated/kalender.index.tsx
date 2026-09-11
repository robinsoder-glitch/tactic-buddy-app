import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell, MapPin, Trophy } from "lucide-react";
import { fetchUpcomingEvents } from "@/lib/event-planning";
import { PlanStatusBadge, PlanStatusBadgePending } from "@/components/PlanStatusBadge";
import { planStatus } from "@/lib/plan-status";
import { fetchEventPlans, fetchEventResources, fetchSquads } from "@/lib/planning";
import { fetchEventCoaches } from "@/lib/event-coaches";
import { formatDateTime } from "@/lib/teams";
import { eventTitleLine, eventTypeLabel, isCancelled } from "@/lib/event-labels";
import { MonthCalendar } from "@/components/MonthCalendar";
import { useAccount } from "@/hooks/useAccount";
import { MatchStatusControl } from "@/components/MatchStatusControl";
import { fetchEventsWithInvitations, matchStatus } from "@/lib/match-status";

/** Träning och match har egen symbol och färg så de går att skilja åt direkt. */
const EVENT_STYLES = {
  training: {
    icon: Dumbbell,
    label: "Träning",
    card: "border-l-4 border-l-emerald-500",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    icon_color: "text-emerald-600 dark:text-emerald-400",
  },
  match: {
    icon: Trophy,
    label: "Match",
    card: "border-l-4 border-l-amber-500",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    icon_color: "text-amber-600 dark:text-amber-400",
  },
} as const;

export const Route = createFileRoute("/_authenticated/kalender/")({
  head: () => ({
    meta: [
      { title: "Kalender – träningar och matcher" },
      {
        name: "description",
        content: "Se alla kommande träningar och matcher i dina lag, och svara på dina kallelser.",
      },
      { property: "og:title", content: "Kalender – träningar och matcher" },
      { property: "og:description", content: "Kommande träningar och matcher i dina lag." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarOverview,
});

function CalendarOverview() {
  const { isCoach } = useAccount();
  const events = useQuery({ queryKey: ["upcoming-events"], queryFn: () => fetchUpcomingEvents() });
  const ids = (events.data ?? []).map((event) => event.id);
  const plans = useQuery({
    queryKey: ["event-plans", ids.join(",")],
    queryFn: () => fetchEventPlans(ids),
    enabled: ids.length > 0,
  });
  const resources = useQuery({
    queryKey: ["event-resources", ids.join(",")],
    queryFn: () => fetchEventResources(ids),
    enabled: ids.length > 0,
  });
  const squads = useQuery({
    queryKey: ["event-squads", ids.join(",")],
    queryFn: () => fetchSquads(ids),
    enabled: ids.length > 0,
  });
  const coaches = useQuery({
    queryKey: ["event-coaches", ids.join(",")],
    queryFn: () => fetchEventCoaches(ids),
    enabled: ids.length > 0,
  });
  const matchIds = (events.data ?? [])
    .filter((event) => event.type === "match")
    .map((event) => event.id);
  const invited = useQuery({
    queryKey: ["event-invited", matchIds.join(",")],
    queryFn: () => fetchEventsWithInvitations(matchIds),
    enabled: matchIds.length > 0,
  });

  // Statusen får bara visas när allt underlag finns – annars hinner ett
  // felaktigt "Ej klar" synas innan svaren kommer in.
  // Ett fel i något underlag ger okänd status – aldrig ett påstående om "Ej planerad".
  const statusReady =
    ids.length === 0 || [plans, resources, squads, coaches].every((query) => query.isSuccess);

  /** Samma statusregel som i Planera match och Planera träning. */
  function statusFor(event: { id: string; type?: string | null }) {
    return planStatus({
      type: event.type ?? "training",
      planSaved: (plans.data ?? []).some((row) => row.event_id === event.id),
      resourceCount: (resources.data ?? []).filter(
        (row) => row.event_id === event.id && row.kind !== "tactic",
      ).length,
      playerCount: (squads.data ?? []).filter((row) => row.event_id === event.id).length,
      coachCount: (coaches.data ?? []).filter((row) => row.event_id === event.id).length,
    });
  }

  if (events.isLoading) {
    return <p className="pt-6 text-sm text-muted-foreground">Laddar…</p>;
  }

  if (events.isError) {
    return (
      <p className="pt-6 text-sm text-muted-foreground">Kalendern kunde inte hämtas just nu.</p>
    );
  }

  const list = events.data ?? [];

  return (
    <>
      <MonthCalendar />
      <section className="pt-6">
        <h2 className="font-display text-xl font-bold">Kommande aktiviteter</h2>
        {list.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Inget inplanerat just nu.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {list.map((event) => {
              const style = EVENT_STYLES[event.type === "match" ? "match" : "training"];
              const Icon = style.icon;
              return (
                <li key={event.id}>
                  <Link
                    to="/team/$teamId/event/$eventId"
                    params={{ teamId: event.team_id, eventId: event.id }}
                    className={`flex gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/50 ${style.card}`}
                  >
                    <Icon className={`mt-1 size-5 shrink-0 ${style.icon_color}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {eventTitleLine(event) || eventTypeLabel(event)}
                          </p>
                          <p className="text-sm text-primary">{formatDateTime(event.starts_at)}</p>
                        </div>
                        <p className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                          {isCoach &&
                            (statusReady ? (
                              <PlanStatusBadge status={statusFor(event)} />
                            ) : (
                              <PlanStatusBadgePending />
                            ))}
                          {event.type === "match" && (
                            <MatchStatusControl
                              eventId={event.id}
                              teamId={event.team_id}
                              status={matchStatus({
                                override: event.match_status ?? null,
                                startsAt: event.starts_at,
                                hasInvitations: invited.data?.has(event.id) ?? false,
                              })}
                              size="sm"
                            />
                          )}
                          {isCancelled(event) && (
                            <span className="rounded bg-destructive/15 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                              Inställd
                            </span>
                          )}
                        </p>
                      </div>
                      {(event.team_name || event.location) && (
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          {event.team_name && <span>{event.team_name}</span>}
                          {event.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" /> {event.location}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
