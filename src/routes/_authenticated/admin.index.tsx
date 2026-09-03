import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchPlatformStats } from "@/lib/admin-data";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminOverview,
});

const LABELS: Record<string, string> = {
  clubs: "Klubbar",
  teams: "Lag",
  players: "Spelare",
  events: "Aktiviteter",
  tactics: "Taktiker",
  coach_sessions: "Träningspass",
};

function AdminOverview() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: fetchPlatformStats });

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(LABELS).map(([key, label]) => (
          <div key={key} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="font-display text-3xl font-bold">
              {stats.data?.[key as keyof typeof stats.data] ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/admin/konton"
          className="rounded-xl border border-border bg-card p-4 hover:bg-accent"
        >
          <h2 className="font-display text-xl font-semibold">Konton</h2>
          <p className="text-sm text-muted-foreground">
            Se alla som skapat konto, ge admin eller radera konton.
          </p>
        </Link>
        <Link
          to="/admin/lag"
          className="rounded-xl border border-border bg-card p-4 hover:bg-accent"
        >
          <h2 className="font-display text-xl font-semibold">Lag & klubbar</h2>
          <p className="text-sm text-muted-foreground">
            Öppna vilket lag som helst, ändra uppgifter och medlemmar.
          </p>
        </Link>
      </div>
    </section>
  );
}
