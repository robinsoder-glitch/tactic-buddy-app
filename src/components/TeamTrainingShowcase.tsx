import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Clock3, ListChecks, X } from "lucide-react";
import {
  fetchTeamCoachSessions,
  fetchTeamSessionItems,
  ITEM_KIND_LABELS,
  teamSessionsForDisplay,
  totalMinutes,
  type CoachSession,
  type CoachSessionItem,
  type ItemKind,
} from "@/lib/coach-sessions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function sessionDate(value: string | null) {
  if (!value) return "Datum ej valt";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function SessionPresentation({
  session,
  items,
}: {
  session: CoachSession;
  items: CoachSessionItem[];
}) {
  let elapsed = 0;
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium text-primary">{sessionDate(session.session_date)}</p>
        {session.theme && (
          <p className="mt-1 text-lg text-muted-foreground">Tema: {session.theme}</p>
        )}
        {session.goal && (
          <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-4">
            <p className="text-sm font-semibold text-primary">Dagens mål</p>
            <p className="mt-1 text-lg">{session.goal}</p>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
          Inga övningar är tillagda i passet ännu.
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((item, index) => {
            const start = elapsed;
            elapsed += item.minutes;
            return (
              <li key={item.id} className="rounded-lg border border-border bg-card p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="font-display text-xl font-bold sm:text-2xl">{item.title}</h3>
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                        <Clock3 className="size-4" /> {start}–{elapsed} min
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {ITEM_KIND_LABELS[item.kind as ItemKind] ?? "Aktivitet"} · {item.minutes}{" "}
                      minuter
                    </p>
                    {item.note && (
                      <p className="mt-3 whitespace-pre-wrap text-base sm:text-lg">{item.note}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function TeamTrainingShowcase({ teamId }: { teamId: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sessionsQuery = useQuery({
    queryKey: ["team-coach-sessions", teamId],
    queryFn: () => fetchTeamCoachSessions(teamId),
  });
  const sessions = useMemo(
    () => teamSessionsForDisplay(sessionsQuery.data ?? [], teamId),
    [sessionsQuery.data, teamId],
  );
  const itemQuery = useQuery({
    queryKey: ["team-session-items", teamId, sessions.map((session) => session.id).join(",")],
    queryFn: () => fetchTeamSessionItems(sessions.map((session) => session.id)),
    enabled: sessions.length > 0,
  });
  const items = itemQuery.data ?? [];
  const selected = sessions.find((session) => session.id === selectedId) ?? null;
  const selectedItems = selected ? items.filter((item) => item.session_id === selected.id) : [];

  useEffect(() => {
    if (selectedId && !sessions.some((session) => session.id === selectedId)) setSelectedId(null);
  }, [selectedId, sessions]);

  if (sessionsQuery.isLoading || itemQuery.isLoading) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Hämtar lagets övningar…</p>
    );
  }

  if (sessionsQuery.isError || itemQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-5 text-center">
        <p className="font-semibold text-destructive">Det gick inte att hämta övningarna.</p>
        <Button className="mt-3" variant="outline" onClick={() => void sessionsQuery.refetch()}>
          Försök igen
        </Button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <ListChecks className="mx-auto size-9 text-primary" />
        <h2 className="mt-3 font-display text-xl font-bold">Inga träningspass för laget ännu</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Koppla ett sparat träningspass till laget, så kan du visa övningarna här.
        </p>
        <Button asChild className="mt-4">
          <Link to="/traningspass">Gå till Mina träningar</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Övningar inför träningen</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Öppna ett pass och visa upplägget för spelarna.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/traningspass">Hantera träningar</Link>
        </Button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
        {sessions.map((session) => {
          const sessionItems = items.filter((item) => item.session_id === session.id);
          return (
            <li key={session.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-bold">{session.title}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-4" /> {sessionDate(session.session_date)}
                    </span>
                    <span>{sessionItems.length} delar</span>
                    <span>{totalMinutes(sessionItems)} minuter</span>
                  </p>
                  {session.theme && <p className="mt-1 text-sm">Tema: {session.theme}</p>}
                </div>
                <Button onClick={() => setSelectedId(session.id)}>
                  <BookOpen className="size-4" /> Visa för spelarna
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto sm:max-w-4xl">
          <DialogHeader className="pr-8">
            <DialogTitle className="font-display text-2xl sm:text-3xl">
              {selected?.title ?? "Träningspass"}
            </DialogTitle>
          </DialogHeader>
          {selected && <SessionPresentation session={selected} items={selectedItems} />}
          <Button variant="outline" onClick={() => setSelectedId(null)}>
            <X className="size-4" /> Stäng visningen
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
