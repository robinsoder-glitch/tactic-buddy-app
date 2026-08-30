import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dumbbell, MapPin, Trophy } from "lucide-react";
import { fetchUpcomingEvents } from "@/lib/event-planning";
import { formatDateTime } from "@/lib/teams";

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
  const events = useQuery({ queryKey: ["upcoming-events"], queryFn: () => fetchUpcomingEvents() });

  if (events.isLoading) {
    return <p className="pt-6 text-sm text-muted-foreground">Laddar…</p>;
  }

  if (events.isError) {
    return <p className="pt-6 text-sm text-muted-foreground">Kalendern kunde inte hämtas just nu.</p>;
  }

  const list = events.data ?? [];

  return (
    <section className="pt-4">
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
                  <div className="min-w-0">
                    <p className="font-medium">
                      {event.title ?? style.label}
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${style.badge}`}
                      >
                        {style.label}
                      </span>
                    </p>
                    <p className="text-sm text-primary">{formatDateTime(event.starts_at)}</p>
                    {event.team_name && <p className="text-xs text-muted-foreground">{event.team_name}</p>}
                    {event.location && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3" /> {event.location}
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
  );
}
