import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { LineupPitch, type LineupPlayerInfo } from "@/components/LineupPitch";
import { fetchSharedMatch, type SharedMatch } from "@/lib/match-plan";
import { BRAND_NAME } from "@/lib/brand";

export const Route = createFileRoute("/delad-match/$token")({
  head: () => ({
    meta: [
      { title: `Delad laguppställning – ${BRAND_NAME}` },
      { name: "description", content: "Skrivskyddad laguppställning delad från Fotbollsrummet." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedMatchPage,
});

function SharedMatchPage() {
  const { token } = Route.useParams();
  const [match, setMatch] = useState<SharedMatch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setMatch(await fetchSharedMatch(token));
      } catch {
        setMatch(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const players = new Map<string, LineupPlayerInfo>();
  const slots = (match?.players ?? []).map((p, i) => ({
    slot: i + 1,
    player_id: p.name ? `p${i}` : null,
    x: p.x,
    y: p.y,
    ...(p.gk ? { gk: true } : {}),
  }));
  match?.players.forEach((p, i) => {
    if (p.name) players.set(`p${i}`, { name: p.name, number: p.number });
  });

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
        {loading && <p className="text-sm text-muted-foreground">Hämtar laguppställning…</p>}
        {!loading && !match && (
          <div className="rounded-xl border bg-card p-6 text-center">
            <h1 className="text-lg font-semibold">Länken fungerar inte längre</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Delningslänken har återkallats, passerat sitt slutdatum eller är felaktig.
            </p>
          </div>
        )}
        {!loading && match && (
          <>
            <div className="space-y-1">
              <h1 className="font-display text-2xl font-bold">
                {match.home_team && match.opponent
                  ? `${match.home_team} – ${match.opponent}`
                  : `${match.team_name} – ${match.opponent ?? "Motståndare"}`}
              </h1>
              <p className="text-sm text-muted-foreground">
                {new Date(match.starts_at).toLocaleString("sv-SE", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {match.location ? ` · ${match.location}` : ""}
                {match.match_kind ? ` · ${match.match_kind}` : ""}
              </p>
              {match.meet_at && (
                <p className="text-sm text-muted-foreground">
                  Samling{" "}
                  {new Date(match.meet_at).toLocaleTimeString("sv-SE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
            <LineupPitch slots={slots} players={players} />
            {match.bench.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Avbytare:{" "}
                {match.bench
                  .map((p) => `${p.number != null ? `${p.number} ` : ""}${p.name}`)
                  .join(", ")}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Delad via {BRAND_NAME} – skrivskyddad visning.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
