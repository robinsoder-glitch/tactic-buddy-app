import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Dumbbell, MapPin, Trophy } from "lucide-react";
import { fetchEventsInRange, type PlannableEvent } from "@/lib/event-planning";
import {
  dayKey,
  groupByDay,
  monthGrid,
  monthLabel,
  monthRange,
  shiftMonth,
  WEEKDAY_NAMES,
  type MonthCursor,
} from "@/lib/month-grid";
import { eventTitleLine } from "@/lib/event-labels";
import { fetchEventsWithInvitations, matchStatus } from "@/lib/match-status";
import { MatchStatusControl } from "@/components/MatchStatusControl";

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

function longDay(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year!, (month ?? 1) - 1, day ?? 1).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Månadsöversikt: stora dagrutor att trycka på och en tydlig lista under. */
export function MonthCalendar() {
  const today = new Date();
  const [cursor, setCursor] = useState<MonthCursor>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [selected, setSelected] = useState<string>(dayKey(today));
  const range = monthRange(cursor);

  const events = useQuery({
    queryKey: ["month-events", range.fromIso, range.toIso],
    queryFn: () => fetchEventsInRange(range.fromIso, range.toIso),
  });

  const matchIds = useMemo(
    () => (events.data ?? []).filter((event) => event.type === "match").map((event) => event.id),
    [events.data],
  );
  const invited = useQuery({
    queryKey: ["month-invited", matchIds.join(",")],
    queryFn: () => fetchEventsWithInvitations(matchIds),
    enabled: matchIds.length > 0,
  });

  const byDay = groupByDay<PlannableEvent>(events.data ?? []);
  const days = monthGrid(cursor);
  const todayKey = dayKey(today);
  const selectedList = byDay.get(selected) ?? [];

  function statusOf(event: PlannableEvent) {
    return matchStatus({
      override: event.match_status ?? null,
      startsAt: event.starts_at,
      hasInvitations: invited.data?.has(event.id) ?? false,
    });
  }

  return (
    <section className="pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold capitalize sm:text-2xl">
          {monthLabel(cursor)}
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Föregående månad"
            onClick={() => setCursor((current) => shiftMonth(current, -1))}
            className="flex size-12 items-center justify-center rounded-xl border border-border hover:border-primary/50"
          >
            <ChevronLeft className="size-6" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              setCursor({ year: today.getFullYear(), month: today.getMonth() });
              setSelected(todayKey);
            }}
            className="h-12 rounded-xl border border-border px-4 text-base font-medium hover:border-primary/50"
          >
            Idag
          </button>
          <button
            type="button"
            aria-label="Nästa månad"
            onClick={() => setCursor((current) => shiftMonth(current, 1))}
            className="flex size-12 items-center justify-center rounded-xl border border-border hover:border-primary/50"
          >
            <ChevronRight className="size-6" aria-hidden />
          </button>
        </div>
      </div>

      {events.isError && (
        <p className="mt-2 text-sm text-muted-foreground">Månaden kunde inte hämtas just nu.</p>
      )}

      <div className="mt-3 grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-border bg-border">
        {WEEKDAY_NAMES.map((name) => (
          <div
            key={name}
            className="bg-muted/50 py-1 text-center text-[11px] font-semibold uppercase text-muted-foreground"
          >
            {name}
          </div>
        ))}
        {days.map((day) => {
          const list = byDay.get(day.key) ?? [];
          const isSelected = day.key === selected;
          return (
            <button
              key={day.key}
              type="button"
              onClick={() => setSelected(day.key)}
              aria-pressed={isSelected}
              aria-label={`${longDay(day.key)}, ${list.length} aktiviteter`}
              className={`flex min-h-[64px] flex-col items-center gap-1 p-1 text-center transition-colors sm:min-h-[84px] ${
                day.inMonth ? "bg-card" : "bg-card opacity-45"
              } ${isSelected ? "ring-2 ring-inset ring-primary" : ""}`}
            >
              <span
                className={`inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold ${
                  day.key === todayKey
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {day.dayOfMonth}
              </span>
              <span className="flex flex-wrap items-center justify-center gap-0.5">
                {list.slice(0, 4).map((event) => (
                  <span
                    key={event.id}
                    className={`size-2.5 rounded-full ${
                      event.type === "match" ? "bg-amber-500" : "bg-emerald-500"
                    }`}
                  />
                ))}
              </span>
              {list.length > 0 && (
                <span className="hidden text-[10px] text-muted-foreground sm:block">
                  {list.length} st
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <h3 className="font-display text-lg font-bold capitalize">{longDay(selected)}</h3>
        {selectedList.length === 0 ? (
          <p className="mt-2 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            Inget inplanerat den här dagen.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {selectedList.map((event) => {
              const isMatch = event.type === "match";
              const Icon = isMatch ? Trophy : Dumbbell;
              return (
                <li
                  key={event.id}
                  className={`rounded-xl border border-border bg-card p-3 ${
                    isMatch ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-emerald-500"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Icon
                      className={`mt-0.5 size-5 shrink-0 ${isMatch ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/team/$teamId/event/$eventId"
                        params={{ teamId: event.team_id, eventId: event.id }}
                        className="block font-semibold hover:underline"
                      >
                        {timeOf(event.starts_at)}{" "}
                        {eventTitleLine(event) || (isMatch ? "Match" : "Träning")}
                      </Link>
                      {event.team_name && (
                        <p className="text-xs text-muted-foreground">{event.team_name}</p>
                      )}
                      {event.location && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3" aria-hidden /> {event.location}
                        </p>
                      )}
                      {isMatch && (
                        <div className="mt-2">
                          <MatchStatusControl
                            eventId={event.id}
                            teamId={event.team_id}
                            status={statusOf(event)}
                            size="sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
