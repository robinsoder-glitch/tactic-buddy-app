import { Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { fetchUpcomingEvents } from "@/lib/event-planning";
import { fetchCoachSession } from "@/lib/coach-sessions";
import { parsePickSearch } from "@/lib/training-pick";
import { formatDateTime } from "@/lib/teams";

/** Visas överst i Träningsbanken när den öppnats från en träningsplanering. */
export function PickModeBanner() {
  const search = parsePickSearch(useSearch({ strict: false }) as Record<string, unknown>);
  const session = useQuery({
    queryKey: ["coach-session", search.sessionId],
    queryFn: () => fetchCoachSession(search.sessionId as string),
    enabled: !!search.sessionId,
  });
  const events = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: () => fetchUpcomingEvents(),
    enabled: !!search.eventId,
  });

  if (search.sessionId) {
    const sessionId = search.sessionId;
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary bg-primary/10 p-3">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-muted-foreground">Du plockar övningar till</p>
          <p className="font-semibold">{session.data?.title ?? "Ditt träningspass"}</p>
          <p className="text-sm text-primary">Passet ligger kvar och väntar</p>
        </div>
        <Link
          to="/traningspass/$id"
          params={{ id: sessionId }}
          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:border-primary"
        >
          <ArrowLeft className="size-4" aria-hidden /> Tillbaka till passet
        </Link>
      </div>
    );
  }

  if (!search.eventId) return null;
  const event = (events.data ?? []).find((row) => row.id === search.eventId) ?? null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary bg-primary/10 p-3">
      <div className="min-w-0">
        <p className="text-xs tracking-wide text-muted-foreground">Du plockar övningar till</p>
        <p className="font-semibold">{event?.title ?? "Träning"}</p>
        <p className="text-sm text-primary">
          {event ? formatDateTime(event.starts_at) : "Träningsplanering"}
        </p>
      </div>
      <Link
        to="/planera-traning"
        search={{ eventId: search.eventId, mode: "edit" as const }}
        className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-2 text-sm hover:border-primary"
      >
        <ArrowLeft className="size-4" aria-hidden /> Tillbaka till planeringen
      </Link>
    </div>
  );
}
