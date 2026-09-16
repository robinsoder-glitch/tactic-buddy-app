import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, UserMinus, UserRound } from "lucide-react";
import { TeamCoachOnly } from "@/components/TeamCoachOnly";
import { fetchLeftTeamPlayers, formatDateTime } from "@/lib/teams";

export const Route = createFileRoute("/_authenticated/team/$teamId/lamnade")({
  head: () => ({
    meta: [
      { title: "Lämnade spelare – följ upp truppen" },
      {
        name: "description",
        content:
          "Se vilka spelare som har lämnat laget och när, så att ledaren kan följa upp dem i lugn och ro.",
      },
      { property: "og:title", content: "Lämnade spelare" },
      {
        property: "og:description",
        content: "Lista över spelare som lämnat laget och när de lämnade.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeftPlayersGuarded,
});

function LeftPlayersGuarded() {
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/lamnade" });
  return (
    <TeamCoachOnly teamId={teamId}>
      <LeftPlayersPage />
    </TeamCoachOnly>
  );
}

function LeftPlayersPage() {
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/lamnade" });
  const left = useQuery({
    queryKey: ["team-players-left", teamId],
    queryFn: () => fetchLeftTeamPlayers(teamId),
  });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4">
      <Link
        to="/team/$teamId/trupp"
        params={{ teamId }}
        className="inline-flex items-center gap-1 text-sm text-primary"
      >
        <ArrowLeft className="size-4" /> Till laget
      </Link>

      <h1 className="mt-3 flex items-center gap-2 font-display text-2xl font-bold">
        <UserMinus className="size-5 text-primary" /> Lämnade spelare
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Spelare som har lämnat laget finns kvar här så att du kan följa upp dem. De syns inte i
        truppen, i kalendern eller bland kallelserna.
      </p>

      {left.isPending && <p className="mt-6 text-sm text-muted-foreground">Hämtar …</p>}
      {left.isError && (
        <p className="mt-6 text-sm text-destructive">
          Kunde inte hämta listan. Ladda om sidan och försök igen.
        </p>
      )}

      {left.data && (
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {left.data.length === 0 && (
            <li className="p-6 text-center text-sm text-muted-foreground">
              Ingen har lämnat laget.
            </li>
          )}
          {left.data.map((player) => (
            <li key={player.id} className="flex items-center gap-3 p-3">
              <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                {player.photoUrl ? (
                  <img src={player.photoUrl} alt={player.name} className="size-full object-cover" />
                ) : (
                  <UserRound className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {player.number != null && (
                    <span className="mr-2 text-primary">#{player.number}</span>
                  )}
                  {player.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {player.left_at ? `Lämnade ${formatDateTime(player.left_at)}` : "Avaktiverad"}
                </p>
              </div>
              <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
                Lämnad
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
