import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useTeamRole } from "@/hooks/useTeamRole";
import { fetchTeamPlayers, GENDER_LABELS } from "@/lib/teams";
import {
  deletePlayerStat,
  emptyStat,
  fetchPlayerStats,
  savePlayerStat,
  statTotals,
  type PlayerStatInput,
} from "@/lib/player-stats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ConfirmDelete";
import { GuardianLinks } from "@/components/GuardianLinks";
import { PlayerAccountLink } from "@/components/PlayerAccountLink";
import { PlayerDevelopment } from "@/components/PlayerDevelopment";

export const Route = createFileRoute("/_authenticated/team/$teamId/player/$playerId")({
  component: PlayerPage,
});

const FIELDS: [keyof PlayerStatInput, string, string][] = [
  ["matches", "M", "Matcher"],
  ["goals", "M\u00e5l", "M\u00e5l"],
  ["assists", "A", "Assist"],
  ["yellow_cards", "GK", "Gula kort"],
  ["red_cards", "RK", "R\u00f6da kort"],
  ["points", "P", "Po\u00e4ng"],
];

function PlayerPage() {
  const { teamId, playerId } = useParams({ from: "/_authenticated/team/$teamId/player/$playerId" });
  const { isCoach, userId } = useTeamRole(teamId);
  const queryClient = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [editing, setEditing] = useState<PlayerStatInput | null>(null);

  const players = useQuery({
    queryKey: ["team-players", teamId],
    queryFn: () => fetchTeamPlayers(teamId),
  });
  const stats = useQuery({
    queryKey: ["player-stats", playerId],
    queryFn: () => fetchPlayerStats(playerId),
  });

  const player = players.data?.find((item) => item.id === playerId) ?? null;
  const rows = stats.data ?? [];
  const totals = statTotals(rows);

  const save = useMutation({
    mutationFn: async (input: PlayerStatInput) => {
      if (!userId) throw new Error("Inte inloggad");
      if (!input.competition.trim()) throw new Error("Ange serie eller cup");
      await savePlayerStat(input, userId);
    },
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["player-stats", playerId] });
      toast.success("Statistiken sparades");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Kunde inte spara"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePlayerStat(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["player-stats", playerId] }),
    onError: () => toast.error("Kunde inte radera raden"),
  });

  const age = player?.birth_date
    ? Math.floor((Date.now() - new Date(player.birth_date).getTime()) / 31557600000)
    : null;

  return (
    <section>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka till truppen">
          <Link to="/team/$teamId" params={{ teamId }}>
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h2 className="font-display text-2xl font-bold">{player?.name ?? "Spelare"}</h2>
      </div>

      <div className="mt-4 flex gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary">
          {player?.photoUrl ? (
            <img src={player.photoUrl} alt={player.name} className="size-full object-cover" />
          ) : (
            <UserRound className="size-10 text-muted-foreground" />
          )}
        </div>
        <dl className="grid flex-1 grid-cols-2 gap-y-2 text-sm">
          {player?.number != null && (
            <>
              <dt className="text-muted-foreground">Nummer</dt>
              <dd>#{player.number}</dd>
            </>
          )}
          {age !== null && (
            <>
              <dt className="text-muted-foreground">Ålder</dt>
              <dd>{age} år</dd>
            </>
          )}
          <dt className="text-muted-foreground">Position</dt>
          <dd>{player?.is_goalkeeper ? "Målvakt" : "Utespelare"}</dd>
          {player?.gender && (
            <>
              <dt className="text-muted-foreground">Kön</dt>
              <dd>{GENDER_LABELS[player.gender] ?? player.gender}</dd>
            </>
          )}
          <dt className="text-muted-foreground">Allergi</dt>
          <dd>
            {player?.has_allergy
              ? `Ja${player.allergy_note ? ` – ${player.allergy_note}` : ""}`
              : "Nej"}
          </dd>
        </dl>
      </div>

      {isCoach && (
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <h3 className="font-display text-lg font-bold">Vårdnadshavare</h3>
          {[
            {
              name: player?.guardian1_name,
              phone: player?.guardian1_phone,
              email: player?.guardian1_email,
            },
            {
              name: player?.guardian2_name,
              phone: player?.guardian2_phone,
              email: player?.guardian2_email,
            },
          ].filter((guardian) => guardian.name || guardian.phone || guardian.email).length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Inga uppgifter ifyllda än.</p>
          ) : (
            <ul className="mt-2 space-y-3 text-sm">
              {[
                {
                  name: player?.guardian1_name,
                  phone: player?.guardian1_phone,
                  email: player?.guardian1_email,
                },
                {
                  name: player?.guardian2_name,
                  phone: player?.guardian2_phone,
                  email: player?.guardian2_email,
                },
              ]
                .filter((guardian) => guardian.name || guardian.phone || guardian.email)
                .map((guardian, index) => (
                  <li key={index}>
                    <p className="font-medium">{guardian.name || `Vårdnadshavare ${index + 1}`}</p>
                    <p className="text-muted-foreground">
                      {guardian.phone && (
                        <a
                          href={`tel:${guardian.phone}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {guardian.phone}
                        </a>
                      )}
                      {guardian.phone && guardian.email ? " · " : null}
                      {guardian.email && (
                        <a
                          href={`mailto:${guardian.email}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {guardian.email}
                        </a>
                      )}
                    </p>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <PlayerAccountLink playerId={playerId} teamId={teamId} canEdit={isCoach} />
      <GuardianLinks playerId={playerId} teamId={teamId} userId={userId} canEdit={isCoach} />
      <PlayerDevelopment teamId={teamId} playerId={playerId} canEdit={isCoach} />

      <div className="mt-6 flex items-center justify-between">
        <h3 className="font-display text-xl font-bold">Statistik</h3>
        {isCoach && (
          <Button size="sm" onClick={() => setEditing(emptyStat(playerId, teamId))}>
            <Plus className="size-4" /> Lägg till
          </Button>
        )}
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[32rem] text-sm">
          <caption className="sr-only">Statistik för {player?.name ?? "spelaren"}</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2">
                Serie/Cup
              </th>
              {FIELDS.map(([key, short, long]) => (
                <th key={String(key)} scope="col" className="px-2 py-2 text-center" title={long}>
                  {short}
                </th>
              ))}
              {isCoach && <th scope="col" className="px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {stats.isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Laddar…
                </td>
              </tr>
            )}
            {!stats.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  {isCoach
                    ? "Ingen statistik ifylld än."
                    : "Tränaren har inte fyllt i någon statistik än."}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/60 last:border-0">
                <td className="px-3 py-2 font-medium">{row.competition}</td>
                {FIELDS.map(([key]) => (
                  <td key={String(key)} className="px-2 py-2 text-center tabular-nums">
                    {row[key] as number}
                  </td>
                ))}
                {isCoach && (
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Redigera rad"
                      onClick={() => setEditing({ ...row })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Radera rad"
                      onClick={() => {
                        void confirm({
                          title: "Radera statistik",
                          description: `Raden ${row.competition} tas bort permanent.`,
                        }).then((ok) => ok && remove.mutate(row.id));
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length > 0 && (
              <tr className="bg-secondary/40 font-semibold">
                <td className="px-3 py-2">Totalt</td>
                {FIELDS.map(([key]) => (
                  <td key={String(key)} className="px-2 py-2 text-center tabular-nums">
                    {totals[key as keyof typeof totals]}
                  </td>
                ))}
                {isCoach && <td />}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        M = matcher, A = assist, GK = gula kort, RK = röda kort, P = poäng.
      </p>

      {isCoach && (
        <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Redigera statistik" : "Ny statistikrad"}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="stat-competition">Serie eller cup</Label>
                  <Input
                    id="stat-competition"
                    maxLength={60}
                    placeholder="T.ex. P2018 vår"
                    value={editing.competition}
                    onChange={(event) =>
                      setEditing({ ...editing, competition: event.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {FIELDS.map(([key, , long]) => (
                    <div key={String(key)} className="space-y-1.5">
                      <Label htmlFor={`stat-${String(key)}`}>{long}</Label>
                      <Input
                        id={`stat-${String(key)}`}
                        inputMode="numeric"
                        value={String(editing[key] ?? 0)}
                        onChange={(event) =>
                          setEditing({
                            ...editing,
                            [key]: Math.min(
                              999,
                              Math.max(0, Number(event.target.value.replace(/\D/g, "")) || 0),
                            ),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => editing && save.mutate(editing)} disabled={save.isPending}>
                Spara
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {confirmDialog}
    </section>
  );
}
