import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchAllClubs, fetchAllTeams } from "@/lib/admin-data";
import { friendlyError } from "@/lib/user-errors";

export const Route = createFileRoute("/_authenticated/admin/lag/")({
  component: AdminTeams,
});

function AdminTeams() {
  const teams = useQuery({ queryKey: ["admin-teams"], queryFn: fetchAllTeams });
  const clubs = useQuery({ queryKey: ["admin-clubs"], queryFn: fetchAllClubs });

  if (teams.isLoading) return <p className="text-muted-foreground">Laddar lag…</p>;
  if (teams.error) return <p className="text-destructive">{friendlyError(teams.error)}</p>;

  return (
    <section className="space-y-3">
      {(teams.data ?? []).map((team) => {
        const club = (clubs.data ?? []).find((item) => item.id === team.club_id);
        return (
          <Link
            key={team.id}
            to="/admin/lag/$teamId"
            params={{ teamId: team.id }}
            className="block rounded-xl border border-border bg-card p-4 hover:bg-accent"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-display text-xl font-semibold">{team.name}</h2>
                <p className="text-xs text-muted-foreground">
                  {[club?.name, team.age_group, team.archived_at ? "Arkiverat" : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </div>
          </Link>
        );
      })}
      {(teams.data ?? []).length === 0 && <p className="text-muted-foreground">Inga lag ännu.</p>}
    </section>
  );
}
