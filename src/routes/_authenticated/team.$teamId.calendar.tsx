import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Download, MapPin } from "lucide-react";
import { fetchEvents, fetchTeam, formatDateTime } from "@/lib/teams";
import { downloadIcs } from "@/lib/ics";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/team/$teamId/calendar")({
  component: CalendarPage,
});

function CalendarPage() {
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/calendar" });
  const events = useQuery({ queryKey: ["events", teamId, "all"], queryFn: () => fetchEvents(teamId) });
  const team = useQuery({ queryKey: ["team", teamId], queryFn: () => fetchTeam(teamId) });

  const upcoming = (events.data ?? []).filter((event) => new Date(event.starts_at) >= new Date());
  const past = (events.data ?? []).filter((event) => new Date(event.starts_at) < new Date()).reverse();

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl font-bold uppercase">Kommande</h2>
        <Button
          size="sm"
          variant="secondary"
          disabled={(events.data ?? []).length === 0}
          onClick={() => downloadIcs(events.data ?? [], team.data?.name ?? "Laget")}
        >
          <Download className="size-4" /> Lägg i kalendern (.ics)
        </Button>
      </div>
      <div>

        <ul className="mt-3 space-y-2">
          {upcoming.length === 0 && (
            <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Inget inplanerat.
            </li>
          )}
          {upcoming.map((event) => (
            <li key={event.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
              <CalendarDays className="mt-1 size-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="font-medium">
                  {event.title ?? (event.type === "training" ? "Träning" : "Match")}
                  <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {event.type === "training" ? "Träning" : "Match"}
                  </span>
                </p>
                <p className="text-sm text-primary">{formatDateTime(event.starts_at)}</p>
                {event.location && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {event.location}
                  </p>
                )}
                {event.notes && <p className="mt-1 text-sm text-muted-foreground">{event.notes}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {past.length > 0 && (
        <div>
          <h2 className="font-display text-lg font-semibold uppercase text-muted-foreground">Tidigare</h2>
          <ul className="mt-3 space-y-2">
            {past.map((event) => (
              <li key={event.id} className="rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">
                {event.title ?? (event.type === "training" ? "Träning" : "Match")} · {formatDateTime(event.starts_at)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
