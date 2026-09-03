import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { useAccount } from "@/hooks/useAccount";

export const Route = createFileRoute("/_authenticated/narvaro")({
  head: () => ({
    meta: [
      { title: "Närvaro – registrera träningar och matcher" },
      {
        name: "description",
        content: "Pricka av truppen efter varje träning och match och se hur många som deltog.",
      },
      { property: "og:title", content: "Närvaro" },
      {
        property: "og:description",
        content: "Registrera närvaro för lagets träningar och matcher.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NarvaroPage,
});

function NarvaroPage() {
  const { memberships, loading } = useAccount();
  const teams = memberships.filter((item) => item.status === "approved");

  if (!loading && teams.length === 1 && teams[0]) {
    return <Navigate to="/team/$teamId/narvaro" params={{ teamId: teams[0].team_id }} replace />;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-8 md:pt-20">
      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold">
          <CalendarCheck className="size-6 text-primary" aria-hidden /> Närvaro
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Välj lag för att registrera närvaro.</p>
      </header>

      {loading && <p className="mt-6 text-sm text-muted-foreground">Laddar …</p>}

      {!loading && teams.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Du är inte med i något lag ännu.
          <Link to="/teams" className="mt-3 block text-primary underline-offset-4 hover:underline">
            Till Mina lag
          </Link>
        </div>
      )}

      <ul className="mt-6 space-y-2">
        {teams.map((item) => (
          <li key={item.team_id}>
            <Link
              to="/team/$teamId/narvaro"
              params={{ teamId: item.team_id }}
              className="block rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold hover:bg-accent"
            >
              {item.team?.name ?? "Laget"}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
