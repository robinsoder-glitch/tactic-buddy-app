import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  fetchLinkedPlayerAccounts,
  fetchPlayerAccount,
  fetchTeamMembers,
  setPlayerAccount,
} from "@/lib/teams";

/**
 * Kopplar spelarens eget konto till spelarkortet. Utan koppling når kallelser
 * bara vårdnadshavarna – därför visas det tydligt på spelarsidan.
 */
export function PlayerAccountLink({
  playerId,
  teamId,
  canEdit,
}: {
  playerId: string;
  teamId: string;
  canEdit: boolean;
}) {
  const queryClient = useQueryClient();

  const account = useQuery({
    queryKey: ["player-account", playerId],
    queryFn: () => fetchPlayerAccount(playerId),
  });
  const members = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: () => fetchTeamMembers(teamId),
    enabled: canEdit,
  });
  const linked = useQuery({
    queryKey: ["linked-player-accounts", teamId],
    queryFn: () => fetchLinkedPlayerAccounts(teamId),
    enabled: canEdit,
  });

  const save = useMutation({
    mutationFn: (userId: string | null) => setPlayerAccount(playerId, userId),
    onSuccess: (_data, userId) => {
      toast.success(userId ? "Kontot är kopplat till spelaren." : "Kopplingen är borttagen.");
      queryClient.invalidateQueries({ queryKey: ["player-account", playerId] });
      queryClient.invalidateQueries({ queryKey: ["linked-player-accounts", teamId] });
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
    },
    onError: () => toast.error("Kunde inte ändra kopplingen."),
  });

  const current = account.data ?? null;
  const options = (members.data ?? []).filter(
    (member) =>
      member.status === "approved" &&
      member.role === "player" &&
      (member.user_id === current || !linked.data?.has(member.user_id)),
  );
  const currentName =
    (members.data ?? []).find((member) => member.user_id === current)?.displayName ?? null;

  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-4">
      <h3 className="font-display text-lg font-bold">Spelarens eget konto</h3>
      <p className="text-xs text-muted-foreground">
        Kopplat konto ser sina egna kallelser och kan svara själv.
      </p>

      <p className="mt-2 text-sm">
        {current ? (
          <>
            Kopplat till <span className="font-medium">{currentName ?? "ett konto i laget"}</span>.
          </>
        ) : (
          "Inget konto är kopplat ännu."
        )}
      </p>

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-[12rem] flex-1 text-sm">
            Godkänt spelarkonto i laget
            <select
              className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
              value={current ?? ""}
              onChange={(event) => save.mutate(event.target.value || null)}
              disabled={save.isPending}
            >
              <option value="">Inget konto</option>
              {options.map((member) => (
                <option key={member.id} value={member.user_id}>
                  {member.displayName ?? "Medlem utan namn"}
                </option>
              ))}
            </select>
          </label>
          {current && (
            <Button variant="secondary" disabled={save.isPending} onClick={() => save.mutate(null)}>
              Koppla loss
            </Button>
          )}
        </div>
      )}
      {canEdit && options.length === 0 && !current && (
        <p className="mt-2 text-xs text-muted-foreground">
          Inga lediga spelarkonton. Spelaren behöver först skapa konto med lagkoden och bli godkänd.
        </p>
      )}
    </div>
  );
}
