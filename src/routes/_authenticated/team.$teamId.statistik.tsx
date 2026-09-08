import { useMemo, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Download } from "lucide-react";
import {
  attendanceCsv,
  eventsInRange,
  fetchTeamAttendance,
  pastEvents,
  percent,
  registeredForPlayer,
  summarize,
} from "@/lib/attendance";
import { fetchEvents, fetchTeamPlayers } from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/team/$teamId/statistik")({
  head: () => ({
    meta: [
      { title: "Statistik – närvaro på träning och match" },
      {
        name: "description",
        content:
          "Se hur många träningar och matcher varje spelare deltagit i, med närvaro i procent och export.",
      },
      { property: "og:title", content: "Statistik" },
      { property: "og:description", content: "Träningar, matcher och närvaro per spelare." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/statistik" });

  const events = useQuery({ queryKey: ["events", teamId], queryFn: () => fetchEvents(teamId) });
  const players = useQuery({
    queryKey: ["team-players", teamId],
    queryFn: () => fetchTeamPlayers(teamId),
  });
  const attendance = useQuery({
    queryKey: ["attendance", teamId],
    queryFn: () => fetchTeamAttendance(teamId),
  });

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const done = useMemo(
    () => eventsInRange(pastEvents(events.data ?? []), from, to),
    [events.data, from, to],
  );
  const summaries = useMemo(
    () => summarize(players.data ?? [], done, attendance.data ?? []),
    [players.data, done, attendance.data],
  );
  const eventIds = useMemo(() => new Set(done.map((event) => event.id)), [done]);
  const registered = useMemo(() => {
    const rows = attendance.data ?? [];
    const map = new Map<string, number>();
    for (const player of players.data ?? []) {
      map.set(player.id, registeredForPlayer(rows, eventIds, player.id));
    }
    return map;
  }, [attendance.data, players.data, eventIds]);

  const loading = events.isLoading || players.isLoading || attendance.isLoading;

  function download() {
    const blob = new Blob([`\uFEFF${attendanceCsv(summaries)}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "narvarostatistik.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold">Statistik</h2>
          <p className="text-sm text-muted-foreground">
            {done.filter((event) => event.type === "training").length} träningar och{" "}
            {done.filter((event) => event.type === "match").length} matcher är genomförda.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/team/$teamId/narvaro" params={{ teamId }}>
              Närvaro
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={summaries.length === 0}
            aria-label="Ladda ner statistiken som fil"
            onClick={download}
          >
            <Download className="size-4" /> Ladda ner
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-border p-3">
        <div className="space-y-1">
          <Label htmlFor="stat-from" className="text-xs text-muted-foreground">
            Från och med
          </Label>
          <Input
            id="stat-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="stat-to" className="text-xs text-muted-foreground">
            Till och med
          </Label>
          <Input
            id="stat-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="w-40"
          />
        </div>
        {(from || to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFrom("");
              setTo("");
            }}
          >
            Visa hela säsongen
          </Button>
        )}
      </div>

      {loading && <p className="mt-4 text-sm text-muted-foreground">Laddar statistiken…</p>}

      {!loading && summaries.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
          <BarChart3 className="mx-auto size-8 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            Lägg till spelare i truppen för att se statistik.
          </p>
        </div>
      )}

      {summaries.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[540px] text-sm">
            <caption className="sr-only">Närvaro per spelare på träningar och matcher</caption>
            <thead className="bg-secondary/50 text-xs tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-3 py-2 text-left">
                  Spelare
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Träningar
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Träning %
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Matcher
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Match %
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Frånvaro
                </th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((row) => (
                <tr key={row.playerId} className="border-t border-border">
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-right">
                    {row.trainings} / {row.trainingsTotal}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {percent(row.trainings, row.trainingsTotal)} %
                  </td>
                  <td className="px-3 py-2 text-right">
                    {row.matches} / {row.matchesTotal}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {percent(row.matches, row.matchesTotal)} %
                  </td>
                  <td className="px-3 py-2 text-right">{row.absent}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Sen ankomst räknas som deltagande. Sjuk eller skadad och frånvarande räknas som frånvaro.
      </p>
    </section>
  );
}
