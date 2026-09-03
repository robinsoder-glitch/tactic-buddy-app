import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CalendarClock, RefreshCw } from "lucide-react";
import {
  EMPTY_DAY,
  TODO_PREVIEW,
  allDoneText,
  fetchMyDay,
  filterTodo,
  formatWhen,
  greetingName,
  newsLabel,
  nextLabel,
  sortTodo,
  todoBadge,
  type TodoItem,
} from "@/lib/my-day";
import { useAccount } from "@/hooks/useAccount";
import { Button } from "@/components/ui/button";

/** Etapp 4 – personlig startsida: Att göra, Nästa aktivitet, Nytt sedan sist. */
export function MyDay() {
  const { profile, memberships, userId } = useAccount();
  const [context, setContext] = useState("all");
  const [showAll, setShowAll] = useState(false);

  const day = useQuery({
    queryKey: ["my-day", userId],
    queryFn: fetchMyDay,
    enabled: !!userId,
    refetchOnWindowFocus: true,
  });

  const data = day.data ?? EMPTY_DAY;
  const todo = useMemo(() => sortTodo(filterTodo(data.todo, context)), [data.todo, context]);
  const next = useMemo(
    () =>
      context.startsWith("team:")
        ? data.next.filter((event) => event.team_id === context.slice(5))
        : data.next,
    [data.next, context],
  );
  const teams = memberships.filter((m) => m.status === "approved");
  const visible = showAll ? todo : todo.slice(0, TODO_PREVIEW);

  return (
    <section className="space-y-4" aria-label="Min dag">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">
          {greetingName(profile?.display_name)}
        </h2>
        {teams.length > 1 && (
          <label className="text-sm">
            <span className="sr-only">Välj lag</span>
            <select
              value={context}
              onChange={(event) => setContext(event.target.value)}
              className="min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="all">Alla lag</option>
              {teams.map((team) => (
                <option key={team.team_id} value={`team:${team.team_id}`}>
                  {team.team_name ?? "Lag"}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {day.isLoading && (
        <div className="space-y-2" aria-hidden>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl border border-border bg-muted" />
          ))}
        </div>
      )}

      {day.isError && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <AlertCircle className="size-4" aria-hidden /> Kunde inte hämta allt just nu.
          </p>
          <Button variant="outline" className="mt-2" onClick={() => day.refetch()}>
            <RefreshCw className="mr-2 size-4" aria-hidden /> Försök igen
          </Button>
        </div>
      )}

      {!day.isLoading && !day.isError && (
        <>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Att göra
            </h3>
            {todo.length === 0 ? (
              <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                {allDoneText(next)}
              </p>
            ) : (
              <ul className="space-y-2">
                {visible.map((item, index) => (
                  <TodoCard key={`${item.kind}-${item.event_id ?? item.team_id}-${index}`} item={item} />
                ))}
              </ul>
            )}
            {todo.length > TODO_PREVIEW && (
              <Button variant="ghost" onClick={() => setShowAll((value) => !value)}>
                {showAll ? "Visa färre" : `Visa alla (${todo.length})`}
              </Button>
            )}
          </div>

          {next.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Nästa aktivitet
              </h3>
              <ul className="space-y-2">
                {next.slice(0, 2).map((event) => (
                  <li key={event.event_id} className="rounded-xl border border-border bg-card p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <CalendarClock className="size-4 text-primary" aria-hidden />
                      {event.title} – {nextLabel(event)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {event.team_name}
                      {event.location ? ` · ${event.location}` : ""}
                      {event.meet_at ? ` · Samling ${formatWhen(event.meet_at)}` : ""}
                    </p>
                    <Link
                      to="/team/$teamId/event/$eventId"
                      params={{ teamId: event.team_id, eventId: event.event_id }}
                      className="mt-2 inline-block text-sm font-semibold text-primary underline"
                    >
                      Öppna aktiviteten
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.news.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Nytt sedan sist
              </h3>
              <ul className="space-y-1">
                {data.news.slice(0, 5).map((item, index) => (
                  <li
                    key={`${item.created_at}-${index}`}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  >
                    <span className="font-semibold">{newsLabel(item.kind)}:</span> {item.title}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatWhen(item.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TodoCard({ item }: { item: TodoItem }) {
  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
        {todoBadge(item.kind)}
        {item.team_name ? ` · ${item.team_name}` : ""}
      </p>
      <p className="mt-1 font-semibold">{item.title}</p>
      {item.subtitle && <p className="text-sm text-muted-foreground">{item.subtitle}</p>}
      {item.due_at && (
        <p className="text-xs text-muted-foreground">{formatWhen(item.due_at)}</p>
      )}
      <Link to={item.action_url} className="mt-2 inline-block">
        <Button size="sm">{item.action_label}</Button>
      </Link>
    </li>
  );
}
