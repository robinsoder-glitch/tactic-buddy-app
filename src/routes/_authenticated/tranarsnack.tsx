import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MessagesSquare } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";
import { TeamChatPanel } from "@/components/TeamChatPanel";
import { CoachOnly } from "@/components/CoachOnly";

export const Route = createFileRoute("/_authenticated/tranarsnack")({
  head: () => ({
    meta: [
      { title: "Tränarsnack – chatt för lagets ledare" },
      {
        name: "description",
        content: "Intern chatt där lagets tränare delar instruktioner, råd och tips med varandra.",
      },
      { property: "og:title", content: "Tränarsnack – chatt för lagets ledare" },
      {
        property: "og:description",
        content: "Dela instruktioner, råd och tips med lagets övriga ledare.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <CoachOnly>
      <TranarsnackPage />
    </CoachOnly>
  ),
});

function TranarsnackPage() {
  const { memberships, loading } = useAccount();
  const coachTeams = memberships.filter(
    (item) => item.status === "approved" && item.role === "coach",
  );
  const [teamId, setTeamId] = useState<string | null>(null);
  const active = teamId ?? coachTeams[0]?.team_id ?? null;

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 md:pt-20">
      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold">
          <MessagesSquare className="size-6 text-primary" aria-hidden /> Tränarsnack
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Intern chatt för lagets ledare – dela instruktioner, råd och tips med varandra.
        </p>
      </header>

      {coachTeams.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {coachTeams.map((item) => (
            <button
              key={item.team_id}
              type="button"
              onClick={() => setTeamId(item.team_id)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                item.team_id === active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground"
              }`}
            >
              {item.team?.name ?? "Laget"}
            </button>
          ))}
        </div>
      )}

      <div className="mt-5">
        {loading && <p className="text-sm text-muted-foreground">Laddar …</p>}
        {!loading && !active && (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Tränarsnack finns för dig som är ledare i ett lag.
            <Link
              to="/teams"
              className="mt-3 block text-primary underline-offset-4 hover:underline"
            >
              Till Mina lag
            </Link>
          </div>
        )}
        {active && <TeamChatPanel teamId={active} showHeading={false} />}
      </div>
    </main>
  );
}
