import { useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useTeamRole } from "@/hooks/useTeamRole";
import {
  addTeamInvite,
  fetchTeam,
  fetchTeamInvites,
  fetchTeamMembers,
  removeTeamInvite,
  setMemberRole,
} from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ConfirmDelete";

export const Route = createFileRoute("/_authenticated/team/$teamId/leaders")({
  head: () => ({
    meta: [
      { title: "Ledare – Taktiktavlan" },
      { name: "description", content: "Bjud in fler tränare och ledare till laget." },
      { property: "og:title", content: "Ledare – Taktiktavlan" },
      { property: "og:description", content: "Hantera lagets ledare och inbjudningar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadersPage,
});

function LeadersPage() {
  const { confirm, confirmDialog } = useConfirm();
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/leaders" });
  const { isCoach, userId } = useTeamRole(teamId);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  const team = useQuery({ queryKey: ["team", teamId], queryFn: () => fetchTeam(teamId) });
  const members = useQuery({ queryKey: ["team-members", teamId], queryFn: () => fetchTeamMembers(teamId) });
  const invites = useQuery({
    queryKey: ["team-invites", teamId],
    queryFn: () => fetchTeamInvites(teamId),
    enabled: isCoach,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
    queryClient.invalidateQueries({ queryKey: ["team-invites", teamId] });
  };

  const invite = useMutation({
    mutationFn: () => addTeamInvite({ teamId, userId: userId!, email }),
    onSuccess: () => {
      setEmail("");
      toast.success("Inbjudan sparad. Ge lagkoden till ledaren.");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const drop = useMutation({
    mutationFn: (id: string) => removeTeamInvite(id),
    onSuccess: refresh,
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "coach" | "player" }) => setMemberRole(id, role),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = members.data ?? [];
  const leaders = rows.filter((member) => member.role === "coach");
  const players = rows.filter((member) => member.role === "player" && member.status === "approved");

  if (!isCoach) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold uppercase">Ledare</h2>
        {leaders.map((leader) => (
          <div key={leader.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <ShieldCheck className="size-5 text-primary" />
            <span className="text-sm">{leader.displayName ?? "Ledare"}</span>
          </div>
        ))}
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold uppercase">Lagets ledare</h2>
        {leaders.length === 0 && <p className="text-sm text-muted-foreground">Inga ledare ännu.</p>}
        {leaders.map((leader) => (
          <div key={leader.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <ShieldCheck className="size-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate text-sm">
              {leader.displayName ?? "Ledare"}
              {leader.user_id === userId && <span className="text-muted-foreground"> (du)</span>}
            </span>
            {leader.user_id !== userId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => changeRole.mutate({ id: leader.id, role: "player" })}
              >
                Ta bort ledarroll
              </Button>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold uppercase">Bjud in ledare</h2>
        <p className="text-sm text-muted-foreground">
          Skriv in ledarens e-post och skicka lagkoden{" "}
          <span className="font-mono font-semibold text-foreground">{team.data?.join_code}</span>. När personen
          går med med koden blir hen automatiskt godkänd ledare.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="leader-email">E-post</Label>
            <Input
              id="leader-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ledare@klubb.se"
            />
          </div>
          <Button onClick={() => invite.mutate()} disabled={!email.trim() || invite.isPending}>
            <Plus className="size-4" /> Bjud in
          </Button>
        </div>

        <div className="space-y-2">
          {(invites.data ?? []).map((row) => (
            <div key={row.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <Mail className="size-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm">{row.email}</span>
              <span className="text-xs text-muted-foreground">Väntar</span>
              <Button variant="ghost" size="icon" onClick={() => {
                void confirm({
                  title: "Radera inbjudan",
                  description: `Inbjudan till ${row.email} tas bort. Personen kan inte längre använda den.`,
                }).then((ok) => ok && drop.mutate(row.id));
              }} aria-label="Ta bort inbjudan">
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold uppercase">Gör medlem till ledare</h2>
        {players.length === 0 && <p className="text-sm text-muted-foreground">Inga godkända medlemmar ännu.</p>}
        {players.map((member) => (
          <div key={member.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <UserRound className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm">{member.displayName ?? "Medlem"}</span>
            <Button size="sm" variant="secondary" onClick={() => changeRole.mutate({ id: member.id, role: "coach" })}>
              Gör till ledare
            </Button>
          </div>
        ))}
      </section>
  {confirmDialog}
    </div>
  );
}
