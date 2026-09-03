import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { fetchPlayerGuardians, linkGuardian, setGuardianActive } from "@/lib/guardians";
import { fetchTeamMembers } from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Kopplar vårdnadshavare (befintliga konton i laget) till ett barn.
 * Kopplingen avaktiveras i stället för att raderas så att historiken finns kvar.
 */
export function GuardianLinks({
  playerId,
  teamId,
  userId,
  canEdit,
}: {
  playerId: string;
  teamId: string;
  userId: string | null;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState("");
  const [relation, setRelation] = useState("");

  const links = useQuery({
    queryKey: ["player-guardians", playerId],
    queryFn: () => fetchPlayerGuardians(playerId),
  });
  const members = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: () => fetchTeamMembers(teamId),
    enabled: canEdit,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["player-guardians", playerId] });

  const add = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error("Inte inloggad");
      if (!picked) throw new Error("Välj ett konto");
      return linkGuardian({
        playerId,
        guardianUserId: picked,
        relation: relation.trim() || null,
        createdBy: userId,
      });
    },
    onSuccess: () => {
      setPicked("");
      setRelation("");
      toast.success("Vårdnadshavaren är kopplad till spelaren.");
      refresh();
    },
    onError: () => toast.error("Kunde inte koppla vårdnadshavaren."),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setGuardianActive(id, active),
    onSuccess: () => refresh(),
    onError: () => toast.error("Kunde inte ändra kopplingen."),
  });

  const rows = links.data ?? [];
  const linked = new Set(rows.map((row) => row.guardian_user_id));

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="font-display text-lg font-bold">Kopplade konton</h3>
      <p className="text-xs text-muted-foreground">
        Kopplade vårdnadshavare kan se och svara på spelarens kallelser.
      </p>

      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Inga konton är kopplade ännu.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{row.guardianName ?? "Vårdnadshavare"}</p>
                <p className="text-xs text-muted-foreground">
                  {row.relation ? `${row.relation} · ` : ""}
                  {row.is_active ? "Aktiv" : "Avaktiverad"}
                </p>
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  variant={row.is_active ? "ghost" : "secondary"}
                  disabled={toggle.isPending}
                  onClick={() => toggle.mutate({ id: row.id, active: !row.is_active })}
                >
                  {row.is_active ? "Avaktivera" : "Aktivera"}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="mt-3 space-y-2">
          <label className="block text-sm">
            Konto i laget
            <select
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
            >
              <option value="">Välj konto…</option>
              {(members.data ?? [])
                .filter((member) => !linked.has(member.user_id))
                .map((member) => (
                  <option key={member.id} value={member.user_id}>
                    {member.displayName ?? "Medlem"}
                  </option>
                ))}
            </select>
          </label>
          <Input
            aria-label="Relation till spelaren"
            placeholder="Relation, till exempel mamma eller pappa"
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
          />
          <Button size="sm" disabled={!picked || add.isPending} onClick={() => add.mutate()}>
            Koppla vårdnadshavare
          </Button>
        </div>
      )}
    </div>
  );
}
