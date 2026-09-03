import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Plus, UserRound } from "lucide-react";
import { CoachOnly } from "@/components/CoachOnly";
import { useAccount } from "@/hooks/useAccount";
import {
  addTeamInvite,
  fetchTeamInvites,
  fetchTeamPlayers,
  inviteLink,
  saveTeamPlayer,
} from "@/lib/teams";
import {
  PLAYER_LINK_LABELS,
  fetchPlayerLinks,
  inviteRecipientLabel,
  playerLinkDetail,
  playerLinkState,
} from "@/lib/player-onboarding";
import { friendlyError } from "@/lib/user-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/spelare")({
  component: () => (
    <CoachOnly>
      <PlayersPage />
    </CoachOnly>
  ),
  head: () => ({
    meta: [
      { title: "Spelare – lägg till och bjud in | Fotbollsrummet" },
      {
        name: "description",
        content:
          "Skapa spelare i truppen och bjud in spelaren eller vårdnadshavaren direkt till spelarkortet – utan separat ansökan att godkänna.",
      },
      { property: "og:title", content: "Spelare – lägg till och bjud in" },
      {
        property: "og:description",
        content: "Tränaren skapar spelarkortet och delar en personlig länk som kopplas direkt.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function PlayersPage() {
  const { memberships, userId } = useAccount();
  const queryClient = useQueryClient();

  const coachTeams = useMemo(
    () =>
      memberships
        .filter(
          (item) =>
            item.status === "approved" &&
            ["coach", "head_coach", "club_admin"].includes(item.role) &&
            item.team,
        )
        .map((item) => ({ id: item.team_id, name: item.team?.name ?? "Lag" })),
    [memberships],
  );

  const [teamId, setTeamId] = useState<string>("");
  useEffect(() => {
    if (!teamId && coachTeams[0]) setTeamId(coachTeams[0].id);
  }, [coachTeams, teamId]);

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");

  const players = useQuery({
    queryKey: ["team-players", teamId],
    queryFn: () => fetchTeamPlayers(teamId),
    enabled: !!teamId,
  });
  const links = useQuery({
    queryKey: ["player-links", teamId],
    queryFn: () => fetchPlayerLinks(teamId),
    enabled: !!teamId,
  });
  const invites = useQuery({
    queryKey: ["team-invites", teamId],
    queryFn: () => fetchTeamInvites(teamId),
    enabled: !!teamId,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!userId || !teamId) throw new Error("Välj ett lag först");
      if (!name.trim()) throw new Error("Ange spelarens namn");
      await saveTeamPlayer({
        teamId,
        userId,
        name: name.trim(),
        number: number ? Number(number) : null,
        birth_date: null,
        gender: "none",
        is_goalkeeper: false,
        photo_path: null,
      });
    },
    onSuccess: async () => {
      setName("");
      setNumber("");
      toast.success("Spelaren är tillagd i truppen.");
      await queryClient.invalidateQueries({ queryKey: ["team-players", teamId] });
      await queryClient.invalidateQueries({ queryKey: ["player-links", teamId] });
    },
    onError: (error: Error) => toast.error(friendlyError(error, "Kunde inte lägga till spelaren")),
  });

  const invite = useMutation({
    mutationFn: async (input: {
      playerId: string;
      playerName: string;
      kind: "player" | "guardian";
    }) => {
      if (!userId) throw new Error("Du måste vara inloggad");
      const row = await addTeamInvite({
        teamId,
        userId,
        kind: "link",
        role: "player",
        targetPlayerId: input.playerId,
        recipientLabel: inviteRecipientLabel(input.playerName, input.kind),
      });
      const url = inviteLink(row.token);
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        /* utan urklipp visar vi länken i stället */
      }
      return url;
    },
    onSuccess: async (url) => {
      toast.success("Länken är kopierad", { description: url });
      await queryClient.invalidateQueries({ queryKey: ["team-invites", teamId] });
    },
    onError: (error: Error) => toast.error(friendlyError(error, "Kunde inte skapa inbjudan")),
  });

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="font-display text-2xl font-bold">Spelare</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Lägg till spelaren i truppen och dela en personlig länk. Den som öppnar länken kopplas
        direkt till spelarkortet – du behöver inte godkänna någon separat ansökan.
      </p>

      {coachTeams.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Du är inte godkänd ledare i något lag ännu.
        </p>
      ) : (
        <>
          {coachTeams.length > 1 && (
            <div className="mt-5 space-y-1.5">
              <Label htmlFor="team">Lag</Label>
              <select
                id="team"
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {coachTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <form
            className="mt-5 rounded-xl border border-border bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <h2 className="font-display text-lg font-semibold">Ny spelare</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              <div className="min-w-40 flex-1 space-y-1.5">
                <Label htmlFor="player-name">Namn</Label>
                <Input
                  id="player-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="T.ex. Elias Ek"
                />
              </div>
              <div className="w-24 space-y-1.5">
                <Label htmlFor="player-number">Nummer</Label>
                <Input
                  id="player-number"
                  inputMode="numeric"
                  value={number}
                  onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))}
                />
              </div>
            </div>
            <Button type="submit" className="mt-3" disabled={create.isPending}>
              <Plus className="size-4" /> Lägg till i truppen
            </Button>
          </form>

          <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {players.data?.length === 0 && (
              <li className="p-6 text-center text-sm text-muted-foreground">
                Inga spelare i truppen än.
              </li>
            )}
            {players.data?.map((player) => {
              const state = playerLinkState(player.id, links.data ?? {}, invites.data ?? []);
              return (
                <li key={player.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                      {player.photoUrl ? (
                        <img
                          src={player.photoUrl}
                          alt={player.name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <UserRound className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {player.number != null && (
                          <span className="mr-2 text-primary">#{player.number}</span>
                        )}
                        {player.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {PLAYER_LINK_LABELS[state]} · {playerLinkDetail(links.data?.[player.id])}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={invite.isPending}
                      onClick={() =>
                        invite.mutate({
                          playerId: player.id,
                          playerName: player.name,
                          kind: "player",
                        })
                      }
                    >
                      <Copy className="size-4" /> Länk till spelaren
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={invite.isPending}
                      onClick={() =>
                        invite.mutate({
                          playerId: player.id,
                          playerName: player.name,
                          kind: "guardian",
                        })
                      }
                    >
                      <Copy className="size-4" /> Länk till vårdnadshavare
                    </Button>
                    <Button size="sm" variant="ghost" asChild>
                      <Link
                        to="/team/$teamId/player/$playerId"
                        params={{ teamId, playerId: player.id }}
                      >
                        Öppna spelarkortet
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
