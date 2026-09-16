import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { fetchAllClubs, fetchAllTeams } from "@/lib/admin-data";
import { deleteClubs, deleteTeams } from "@/lib/admin.functions";
import { ConfirmDeleteDialog } from "@/components/admin/ConfirmDeleteDialog";
import { friendlyError } from "@/lib/user-errors";

export const Route = createFileRoute("/_authenticated/admin/lag/")({
  component: AdminTeams,
});

function toggle(set: Set<string>, id: string) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function AdminTeams() {
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: ["admin-teams"], queryFn: fetchAllTeams });
  const clubs = useQuery({ queryKey: ["admin-clubs"], queryFn: fetchAllClubs });

  const removeTeams = useServerFn(deleteTeams);
  const removeClubs = useServerFn(deleteClubs);

  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [selectedClubs, setSelectedClubs] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<null | "teams" | "clubs">(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-teams"] });
    queryClient.invalidateQueries({ queryKey: ["admin-clubs"] });
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
  };

  const teamsMutation = useMutation({
    mutationFn: () => removeTeams({ data: { teamIds: [...selectedTeams] } }),
    onSuccess: (result) => {
      toast.success(`${result.deleted} lag raderades.`);
      setSelectedTeams(new Set());
      setDialog(null);
      refresh();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  const clubsMutation = useMutation({
    mutationFn: () => removeClubs({ data: { clubIds: [...selectedClubs] } }),
    onSuccess: (result) => {
      toast.success(`${result.deletedClubs} klubbar och ${result.deletedTeams} lag raderades.`);
      setSelectedClubs(new Set());
      setSelectedTeams(new Set());
      setDialog(null);
      refresh();
    },
    onError: (error) => toast.error(friendlyError(error)),
  });

  if (teams.isLoading) return <p className="text-muted-foreground">Laddar lag…</p>;
  if (teams.error) return <p className="text-destructive">{friendlyError(teams.error)}</p>;

  const clubList = clubs.data ?? [];
  const teamList = teams.data ?? [];

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">Klubbar</h2>
          <button
            type="button"
            disabled={selectedClubs.size === 0}
            onClick={() => setDialog("clubs")}
            className="min-h-11 rounded-lg border border-destructive px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-40"
          >
            Radera valda klubbar ({selectedClubs.size})
          </button>
        </div>
        <ul className="space-y-2">
          {clubList.map((club) => {
            const teamCount = teamList.filter((team) => team.club_id === club.id).length;
            return (
              <li key={club.id} className="rounded-xl border border-border bg-card p-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={selectedClubs.has(club.id)}
                    onChange={() => setSelectedClubs((prev) => toggle(prev, club.id))}
                    aria-label={`Välj ${club.name}`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{club.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[club.city, `${teamCount} lag`].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
          {clubList.length === 0 && <li className="text-muted-foreground">Inga klubbar ännu.</li>}
        </ul>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">Lag</h2>
          <button
            type="button"
            disabled={selectedTeams.size === 0}
            onClick={() => setDialog("teams")}
            className="min-h-11 rounded-lg border border-destructive px-3 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-40"
          >
            Radera valda lag ({selectedTeams.size})
          </button>
        </div>
        <ul className="space-y-3">
          {teamList.map((team) => {
            const club = clubList.find((item) => item.id === team.club_id);
            return (
              <li
                key={team.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
                <input
                  type="checkbox"
                  className="size-5 shrink-0"
                  checked={selectedTeams.has(team.id)}
                  onChange={() => setSelectedTeams((prev) => toggle(prev, team.id))}
                  aria-label={`Välj ${team.name}`}
                />
                <Link
                  to="/admin/lag/$teamId"
                  params={{ teamId: team.id }}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <span className="block truncate font-display text-xl font-semibold">
                    {team.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {[club?.name, team.age_group, team.archived_at ? "Arkiverat" : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Link>
              </li>
            );
          })}
          {teamList.length === 0 && <li className="text-muted-foreground">Inga lag ännu.</li>}
        </ul>
      </div>

      <ConfirmDeleteDialog
        open={dialog === "teams"}
        onOpenChange={(open) => setDialog(open ? "teams" : null)}
        title={`Radera ${selectedTeams.size} lag?`}
        description="Alla aktiviteter, kallelser, närvaro, spelarkort och bilder i de valda lagen tas bort."
        confirmLabel="Ja, radera lagen"
        pending={teamsMutation.isPending}
        onConfirm={() => teamsMutation.mutate()}
      />
      <ConfirmDeleteDialog
        open={dialog === "clubs"}
        onOpenChange={(open) => setDialog(open ? "clubs" : null)}
        title={`Radera ${selectedClubs.size} klubbar?`}
        description="Klubbarnas alla lag raderas också, med aktiviteter, kallelser, spelarkort och bilder."
        confirmLabel="Ja, radera klubbarna"
        pending={clubsMutation.isPending}
        onConfirm={() => clubsMutation.mutate()}
      />
    </section>
  );
}
