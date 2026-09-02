import { useEffect, useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Crown, Mail, Plus, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useTeamRole } from "@/hooks/useTeamRole";
import {
  INVITE_STATE_LABELS,
  addTeamInvite,
  fetchTeam,
  fetchTeamInvites,
  fetchTeamMembers,
  inviteLink,
  inviteState,
  removeTeamInvite,
  revokeTeamInvite,
  setMemberRole,
  type TeamInvite,
} from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfirm } from "@/components/ConfirmDelete";
import { TEAM_ROLE_DESCRIPTIONS, TEAM_ROLE_LABELS, canRemoveLeader, teamAccess } from "@/lib/permissions";
import { friendlyError } from "@/lib/user-errors";
import { ensureOwnerMembership, transferTeamOwnership } from "@/lib/teams";

export const Route = createFileRoute("/_authenticated/team/$teamId/leaders")({
  head: () => ({
    meta: [
      { title: "Ledare – Fotbollsrummet" },
      { name: "description", content: "Bjud in fler tränare och ledare till laget med personliga inbjudningar." },
      { property: "og:title", content: "Ledare – Fotbollsrummet" },
      { property: "og:description", content: "Hantera lagets ledare och personliga inbjudningar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadersPage,
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

function LeadersPage() {
  const { confirm, confirmDialog } = useConfirm();
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/leaders" });
  const { isCoach, isOwner, canInviteLeaders, canManageLeaders, userId } = useTeamRole(teamId);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [days, setDays] = useState(14);
  const [lastLink, setLastLink] = useState<string | null>(null);

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
    mutationFn: () => addTeamInvite({ teamId, userId: userId!, email, days }),
    onSuccess: (row: TeamInvite) => {
      setEmail("");
      setLastLink(inviteLink(row.token));
      toast.success("Personlig inbjudan skapad. Skicka länken till ledaren.");
      refresh();
    },
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const revoke = useMutation({ mutationFn: (id: string) => revokeTeamInvite(id), onSuccess: refresh });
  const drop = useMutation({ mutationFn: (id: string) => removeTeamInvite(id), onSuccess: refresh });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: "coach" | "player" }) => setMemberRole(id, role),
    onSuccess: refresh,
    onError: (error: Error) => toast.error(friendlyError(error)),
  });

  const rows = members.data ?? [];
  const ownerId = team.data?.created_by ?? null;
  const leaders = rows.filter((member) => member.role === "coach");
  const players = rows.filter((member) => member.role === "player" && member.status === "approved");

  // Äldre lag kunde sakna medlemsrad för skaparen – då visades "Inga ledare ännu".
  useEffect(() => {
    if (!isOwner || !userId || !members.data) return;
    const hasRow = members.data.some((m) => m.user_id === userId && m.role === "coach" && m.status === "approved");
    if (hasRow) return;
    void ensureOwnerMembership(teamId, userId).then(() =>
      queryClient.invalidateQueries({ queryKey: ["team-members", teamId] }),
    );
  }, [isOwner, userId, members.data, teamId, queryClient]);

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Länken är kopierad.");
    } catch {
      toast.error("Kunde inte kopiera. Markera och kopiera länken manuellt.");
    }
  }

  if (!isCoach) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Ledare</h2>
        {leaders.length === 0 && (
          <p className="text-sm text-muted-foreground">Inga ytterligare ledare i laget ännu.</p>
        )}
        {leaders.map((leader) => (
          <div key={leader.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            {leader.user_id === ownerId ? (
              <Crown className="size-5 text-primary" aria-hidden />
            ) : (
              <ShieldCheck className="size-5 text-primary" aria-hidden />
            )}
            <span className="text-sm">
              {leader.displayName ?? "Ledare"}
              {leader.user_id === ownerId && <span className="text-muted-foreground"> · lagägare</span>}
            </span>
          </div>
        ))}
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Lagets ledare</h2>
        {leaders.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Inga ytterligare ledare ännu. Lagets ägare läggs till automatiskt när laget skapas.
          </p>
        )}
        {leaders.map((leader) => (
          <div key={leader.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            {leader.user_id === ownerId ? (
              <Crown className="size-5 shrink-0 text-primary" aria-hidden />
            ) : (
              <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden />
            )}
            <span className="min-w-0 flex-1 truncate text-sm">
              {leader.displayName ?? "Ledare"}
              {leader.user_id === ownerId && <span className="text-muted-foreground"> · lagägare</span>}
              {leader.user_id === userId && <span className="text-muted-foreground"> (du)</span>}
            </span>
            {canRemoveLeader({
              actor: teamAccess({ userId, isAdmin: false, isOwner, membership: { role: "coach", status: "approved" } }),
              targetUserId: leader.user_id,
              ownerUserId: ownerId,
              actorUserId: userId,
            }) && (
              <Button variant="ghost" size="sm" onClick={() => changeRole.mutate({ id: leader.id, role: "player" })}>
                Ta bort ledarroll
              </Button>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold tracking-wide">Vem får göra vad</h2>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {(["owner", "coach", "player", "member"] as const).map((role) => (
            <li key={role}>
              <span className="font-medium text-foreground">{TEAM_ROLE_LABELS[role]}:</span>{" "}
              {TEAM_ROLE_DESCRIPTIONS[role]}
            </li>
          ))}
        </ul>
      </section>

      {canInviteLeaders && (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Bjud in ledare</h2>
        <p className="text-sm text-muted-foreground">
          Inbjudan är personlig: den gäller en e-postadress, kan bara användas en gång, går ut efter vald tid och kan
          återkallas. Lagkoden ger aldrig ledarbehörighet – den skickar bara en ansökan om att gå med.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor="leader-email">E-post</Label>
            <Input
              id="leader-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ledare@klubb.se"
            />
          </div>
          <div>
            <Label htmlFor="leader-days">Giltig i</Label>
            <select
              id="leader-days"
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value={2}>2 dagar</option>
              <option value={7}>7 dagar</option>
              <option value={14}>14 dagar</option>
              <option value={30}>30 dagar</option>
            </select>
          </div>
          <Button onClick={() => invite.mutate()} disabled={!email.trim() || invite.isPending}>
            <Plus className="size-4" aria-hidden /> Skapa inbjudan
          </Button>
        </div>

        {lastLink && (
          <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 p-3">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{lastLink}</span>
            <Button size="sm" variant="secondary" onClick={() => copyLink(lastLink)}>
              <Copy className="size-4" aria-hidden /> Kopiera länk
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {(invites.data ?? []).map((row) => {
            const state = inviteState(row);
            return (
              <div key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Mail className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm">{row.email}</span>
                <span className="text-xs text-muted-foreground">
                  {INVITE_STATE_LABELS[state]}
                  {state === "active" && ` · går ut ${formatDate(row.expires_at)}`}
                </span>
                {state === "active" && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyLink(inviteLink(row.token))}
                      aria-label={`Kopiera inbjudningslänk till ${row.email}`}
                    >
                      <Copy className="size-4" aria-hidden /> Länk
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void confirm({
                          title: "Återkalla inbjudan",
                          description: `Länken till ${row.email} slutar fungera direkt.`,
                        }).then((ok) => ok && revoke.mutate(row.id));
                      }}
                    >
                      Återkalla
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    void confirm({
                      title: "Radera inbjudan",
                      description: `Inbjudan till ${row.email} tas bort helt.`,
                    }).then((ok) => ok && drop.mutate(row.id));
                  }}
                  aria-label={`Ta bort inbjudan till ${row.email}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            );
          })}
        </div>
      </section>
      )}

      {canManageLeaders && (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Gör medlem till ledare</h2>
        {players.length === 0 && <p className="text-sm text-muted-foreground">Inga godkända medlemmar ännu.</p>}
        {players.map((member) => (
          <div key={member.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
            <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-sm">{member.displayName ?? "Medlem"}</span>
            <Button
              size="sm"
              variant="secondary"
              disabled={!canManageLeaders}
              onClick={() => changeRole.mutate({ id: member.id, role: "coach" })}
            >
              Gör till ledare
            </Button>
          </div>
        ))}
      </section>
      )}

      {!canManageLeaders && (
        <p className="text-xs text-muted-foreground">Endast lagägaren kan bjuda in eller ändra ledarroller.</p>
      )}

      {isOwner && leaders.some((leader) => leader.user_id !== userId) && (
        <section className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold tracking-wide">Överlåt lagägarskapet</h2>
          <p className="text-xs text-muted-foreground">
            Den nya ägaren tar över ansvaret för laget. Du blir kvar som ledare.
          </p>
          {leaders
            .filter((leader) => leader.user_id !== userId)
            .map((leader) => (
              <div key={`transfer-${leader.id}`} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">{leader.displayName ?? "Ledare"}</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void confirm({
                      title: "Överlåt lagägarskapet",
                      description: `${leader.displayName ?? "Ledaren"} blir lagägare och kan radera laget. Du blir kvar som ledare.`,
                      confirmLabel: "Överlåt",
                    }).then(async (ok) => {
                      if (!ok) return;
                      try {
                        await transferTeamOwnership(teamId, leader.user_id);
                        refresh();
                        queryClient.invalidateQueries({ queryKey: ["team", teamId] });
                        toast.success("Lagägarskapet är överlåtet.");
                      } catch (error) {
                        toast.error(friendlyError(error, "Kunde inte överlåta lagägarskapet"));
                      }
                    });
                  }}
                >
                  Gör till lagägare
                </Button>
              </div>
            ))}
        </section>
      )}
      {confirmDialog}
    </div>
  );
}
