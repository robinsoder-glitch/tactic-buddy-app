import { useState } from "react";
import { EventManager } from "@/components/EventManager";
import { useAccount } from "@/hooks/useAccount";

export function NewMatchCreator({ onChanged }: { onChanged: () => void }) {
  const { user, memberships, loading } = useAccount();

  const coachTeams = memberships.filter(
    (m) =>
      m.status === "approved" && ["coach", "head_coach", "club_admin"].includes(m.role as string),
  );
  const [teamId, setTeamId] = useState("");
  const activeTeam = teamId || coachTeams[0]?.team_id || "";

  if (loading) return null;
  if (coachTeams.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        Du behöver vara tränare i ett lag för att skapa matcher.
      </p>
    );
  }
  return (
    <section className="space-y-3">
      {coachTeams.length > 1 && (
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={activeTeam}
          onChange={(e) => setTeamId(e.target.value)}
          aria-label="Välj lag"
        >
          {coachTeams.map((m) => (
            <option key={m.team_id} value={m.team_id}>
              {m.team?.name ?? "Lag"}
            </option>
          ))}
        </select>
      )}
      {activeTeam && (
        <EventManager
          teamId={activeTeam}
          userId={user?.id ?? null}
          isCoach
          type="match"
          title="Matchtillfällen"
          newLabel="Boka match"
          hideList
          onChanged={onChanged}
          savedMessage="Matchen har lagts till i kalendern."
        />
      )}
    </section>
  );
}
