import { useMemo } from "react";
import { ErrorState, LoadingState } from "@/components/StateViews";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, CalendarDays, ClipboardList, MessagesSquare } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";
import { useOpenInvites } from "@/hooks/useOpenInvites";
import { useUnreadInbox } from "@/hooks/useUnreadInbox";
import { useUnreadChat } from "@/hooks/useUnreadChat";
import { fetchEvents, formatDateTime } from "@/lib/teams";
import { fetchEventPlans } from "@/lib/planning";
import { eventsMissingPlan, todayEventTitle, upcomingEvents, type TodayEvent } from "@/lib/today";
import { Button } from "@/components/ui/button";

/**
 * Dagsvyn "Idag": nästa aktivitet, obesvarade kallelser, planering som saknas
 * och olästa meddelanden – anpassat efter om du är ledare eller inte.
 */
export function TodayPanel({ isCoach }: { isCoach: boolean }) {
  const { memberships, userId } = useAccount();
  const teams = useMemo(
    () => memberships.filter((item) => item.status === "approved"),
    [memberships],
  );
  const teamIds = useMemo(() => [...new Set(teams.map((item) => item.team_id))], [teams]);
  const teamNames = useMemo(
    () => new Map(teams.map((item) => [item.team_id, item.team?.name ?? null])),
    [teams],
  );

  const events = useQuery({
    queryKey: ["today-events", userId, teamIds],
    enabled: teamIds.length > 0,
    queryFn: async (): Promise<TodayEvent[]> => {
      const lists = await Promise.all(teamIds.map((teamId) => fetchEvents(teamId)));
      return lists.flat().map((event) => ({
        ...event,
        teamName: teamNames.get(event.team_id) ?? null,
      }));
    },
  });

  const next = useMemo(() => upcomingEvents(events.data ?? [], new Date(), 3), [events.data]);
  const upcomingIds = useMemo(
    () => upcomingEvents(events.data ?? [], new Date(), Number.MAX_SAFE_INTEGER).map((e) => e.id),
    [events.data],
  );

  const plans = useQuery({
    queryKey: ["today-plans", upcomingIds],
    enabled: isCoach && upcomingIds.length > 0,
    queryFn: () => fetchEventPlans(upcomingIds),
  });

  const missing = useMemo(
    () =>
      isCoach
        ? eventsMissingPlan(
            events.data ?? [],
            (plans.data ?? []).filter((plan) => plan.planning_done).map((plan) => plan.event_id),
          )
        : [],
    [isCoach, events.data, plans.data],
  );

  const openInvites = useOpenInvites();
  const unreadInbox = useUnreadInbox();
  const unreadChat = useUnreadChat();

  if (teamIds.length === 0) return null;

  return (
    <section aria-labelledby="idag-rubrik" className="glass-card rounded-2xl p-5">
      <h2 id="idag-rubrik" className="font-display text-xl font-semibold">
        Idag
      </h2>

      <div className="mt-4 space-y-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="size-4 text-primary" aria-hidden />
            Nästa aktiviteter
          </p>
          {events.isPending && <LoadingState text="Hämtar aktiviteter …" />}
          {events.isError && (
            <ErrorState
              className="mt-2"
              text="Det gick inte att hämta aktiviteter."
              onRetry={() => void events.refetch()}
            />
          )}

          {!events.isPending && !events.isError && next.length === 0 && (
            <p className="mt-1 text-sm text-muted-foreground">Inget inplanerat framåt.</p>
          )}
          <ul className="mt-2 space-y-2">
            {next.map((event) => (
              <li key={event.id}>
                <Link
                  to="/team/$teamId/event/$eventId"
                  params={{ teamId: event.team_id, eventId: event.id }}
                  className="block rounded-xl border border-border p-3 transition-colors hover:border-primary/50"
                >
                  <span className="block text-sm font-semibold">{todayEventTitle(event)}</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(event.starts_at)}
                    {event.teamName ? ` · ${event.teamName}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {openInvites > 0 && (
          <TodayRow
            icon={<Bell className="size-4 text-primary" aria-hidden />}
            text={`${openInvites} kallelse${openInvites === 1 ? "" : "r"} väntar på svar.`}
            to="/kallelser"
            action="Svara"
          />
        )}

        {isCoach && missing.length > 0 && (
          <TodayRow
            icon={<ClipboardList className="size-4 text-primary" aria-hidden />}
            text={`${missing.length} kommande aktivitet${
              missing.length === 1 ? "" : "er"
            } saknar planering.`}
            to="/planera"
            action="Planera"
          />
        )}

        {unreadInbox + unreadChat > 0 && (
          <TodayRow
            icon={<MessagesSquare className="size-4 text-primary" aria-hidden />}
            text={
              unreadInbox > 0
                ? `${unreadInbox} olästa viktiga meddelanden.`
                : `${unreadChat} olästa meddelanden i lagchatten.`
            }
            to="/meddelanden"
            action="Läs"
          />
        )}
      </div>
    </section>
  );
}

function TodayRow({
  icon,
  text,
  to,
  action,
}: {
  icon: React.ReactNode;
  text: string;
  to: "/kallelser" | "/planera" | "/meddelanden";
  action: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
      <p className="flex items-center gap-2 text-sm">
        {icon}
        {text}
      </p>
      <Button asChild size="sm" variant="secondary">
        <Link to={to}>{action}</Link>
      </Button>
    </div>
  );
}
