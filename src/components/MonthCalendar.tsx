import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { eventTypeLabel } from "@/lib/event-labels";

/** Månadsöversikt där varje träning och match syns på sin dag. */
export function MonthCalendar() {
  const today = new Date();
  const [cursor, setCursor] = useState<MonthCursor>({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const range = monthRange(cursor);
  const events = useQuery({
    queryKey: ["month-events", range.fromIso, range.toIso],
    queryFn: () => fetchEventsInRange(range.fromIso, range.toIso),
  });

  const byDay = groupByDay<PlannableEvent>(events.data ?? []);
  const days = monthGrid(cursor);
  const todayKey = dayKey(today);

  return (
    <section className="pt-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold capitalize">{monthLabel(cursor)}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Föregående månad"
            onClick={() => setCursor((current) => shiftMonth(current, -1))}
            className="flex size-11 items-center justify-center rounded-lg border border-border hover:border-primary/50"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setCursor({ year: today.getFullYear(), month: today.getMonth() })}
            className="h-11 rounded-lg border border-border px-3 text-sm hover:border-primary/50"
          >
            Idag
          </button>
          <button
            type="button"
            aria-label="Nästa månad"
            onClick={() => setCursor((current) => shiftMonth(current, 1))}
            className="flex size-11 items-center justify-center rounded-lg border border-border hover:border-primary/50"
          >
            <ChevronRight className="size-5" aria-hidden />
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
          return (
            <div
              key={day.key}
              className={`min-h-[68px] bg-card p-1 ${day.inMonth ? "" : "opacity-45"}`}
            >
              <span
                className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${
                  day.key === todayKey
                    ? "bg-primary font-bold text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {day.dayOfMonth}
              </span>
              <div className="mt-0.5 space-y-0.5">
                {list.map((event) => (
                  <Link
                    key={event.id}
                    to="/team/$teamId/event/$eventId"
                    params={{ teamId: event.team_id, eventId: event.id }}
                    title={`${eventTypeLabel(event)} ${new Date(event.starts_at).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`}
                    className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium ${
                      event.type === "match"
                        ? "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                        : "bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                    }`}
                  >
                    {new Date(event.starts_at).toLocaleTimeString("sv-SE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    {event.type === "match" ? "Match" : "Träning"}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
