import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Copy, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTeamRole } from "@/hooks/useTeamRole";
import {
  approveTeamJoinRequest,
  fetchTeam,
  fetchTeamCodes,
  fetchTeamMembers,
  fetchTeamPlayers,
  saveTeamPlayer,
} from "@/lib/teams";
import { buildTeamInviteUrl, shareOrigin } from "@/lib/invite-links";
import { copyText } from "@/lib/copy-text";
import { isGuardianOnlyTeam } from "@/lib/team-age";
import { friendlyError } from "@/lib/user-errors";

export const Route = createFileRoute("/_authenticated/team/$teamId/kom-igang")({
  head: () => ({
    meta: [
      { title: "Kom igång med laget – Fotbollsrummet" },
      {
        name: "description",
        content: "Lägg in truppen, dela inbjudan och godkänn familjerna i tre steg.",
      },
      { property: "og:title", content: "Kom igång med laget – Fotbollsrummet" },
      { property: "og:description", content: "Trupp, inbjudan och godkännanden i tre steg." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StartPage,
});

function StartPage() {
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/kom-igang" });
  const { isCoach, userId } = useTeamRole(teamId);
  const queryClient = useQueryClient();

  const team = useQuery({ queryKey: ["team", teamId], queryFn: () => fetchTeam(teamId) });
  const players = useQuery({
    queryKey: ["team-players", teamId],
    queryFn: () => fetchTeamPlayers(teamId),
  });
  const codes = useQuery({
    queryKey: ["team-codes", teamId],
    queryFn: () => fetchTeamCodes(teamId),
    enabled: isCoach,
  });
  const members = useQuery({
    queryKey: ["team-members", teamId],
    queryFn: () => fetchTeamMembers(teamId),
    enabled: isCoach,
  });

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});

  const guardianOnly = isGuardianOnlyTeam(team.data);
  const squad = players.data ?? [];
  const pending = (members.data ?? []).filter((member) => member.status === "pending");
  const inviteUrl = codes.data?.join_code
    ? buildTeamInviteUrl(shareOrigin(), codes.data.join_code)
    : "";

  const addPlayer = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Du måste vara inloggad.");
      if (!name.trim()) throw new Error("Skriv spelarens namn.");
      return saveTeamPlayer({
        teamId,
        userId,
        name: name.trim(),
        number: number.trim() ? Number(number) : null,
        birth_date: null,
        gender: null,
        is_goalkeeper: false,
        photo_path: null,
      });
    },
    onSuccess: async () => {
      setName("");
      setNumber("");
      await queryClient.invalidateQueries({ queryKey: ["team-players", teamId] });
    },
    onError: (error) => toast.error(friendlyError(error, "Kunde inte lägga till spelaren")),
  });

  const approve = useMutation({
    mutationFn: ({ memberId, playerId }: { memberId: string; playerId: string | null }) =>
      approveTeamJoinRequest(memberId, playerId),
    onSuccess: async () => {
      toast.success("Godkänd och kopplad.");
      await queryClient.invalidateQueries({ queryKey: ["team-members", teamId] });
      await queryClient.invalidateQueries({ queryKey: ["team-players", teamId] });
    },
    onError: (error) => toast.error(friendlyError(error, "Kunde inte godkänna ansökan")),
  });

  if (!isCoach) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold">Kom igång</h2>
        <p className="text-sm text-muted-foreground">Bara lagets tränare kan se den här sidan.</p>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-bold">Kom igång med laget</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tre steg. Du kan hoppa över och fortsätta senare – sidan finns kvar under Översikt.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="font-display text-lg font-bold">
          Steg 1 · Lägg in truppen{" "}
          {squad.length > 0 && <Check className="inline size-5 text-primary" aria-hidden />}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Skriv barnens namn, ett i taget. Tröjnummer är valfritt.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label htmlFor="start-player">Spelarens namn</Label>
            <Input
              id="start-player"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Förnamn och efternamn"
            />
          </div>
          <div className="w-24 space-y-1.5">
            <Label htmlFor="start-number">Nummer</Label>
            <Input
              id="start-number"
              inputMode="numeric"
              value={number}
              onChange={(event) => setNumber(event.target.value.replace(/\D/g, ""))}
              placeholder="Valfritt"
            />
          </div>
          <Button disabled={addPlayer.isPending} onClick={() => addPlayer.mutate()}>
            <Plus className="size-4" aria-hidden /> Lägg till
          </Button>
        </div>
        {squad.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            {squad.length} spelare i truppen:{" "}
            {squad
              .slice(0, 8)
              .map((player) => player.name)
              .join(", ")}
            {squad.length > 8 ? " …" : ""}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="font-display text-lg font-bold">Steg 2 · Dela inbjudan</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {guardianOnly
            ? "Skicka länken till vårdnadshavarna. Barnen behöver inga egna konton."
            : "Skicka länken till spelarna och vårdnadshavarna."}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <code className="max-w-full truncate rounded-md bg-muted px-2 py-1 text-xs">
            {inviteUrl || "Hämtar länk…"}
          </code>
          <Button
            size="sm"
            variant="secondary"
            disabled={!inviteUrl}
            onClick={async () => {
              await navigator.clipboard.writeText(inviteUrl);
              toast.success("Inbjudningslänken är kopierad");
            }}
          >
            <Copy className="size-4" aria-hidden /> Kopiera länk
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Lagkod: <span className="font-mono">{codes.data?.join_code ?? "······"}</span>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="font-display text-lg font-bold">Steg 3 · Godkänn</p>
        {pending.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Inga ansökningar just nu. De dyker upp här när familjerna har klickat på länken.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {pending.map((member) => (
              <li key={member.id} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{member.displayName ?? "Nytt konto"}</p>
                <p className="text-xs text-muted-foreground">
                  {member.role === "guardian" ? "Vårdnadshavare" : "Spelare"}
                  {member.guardianForName ? ` till ${member.guardianForName}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    className="h-10 min-w-[10rem] rounded-lg border border-border bg-background px-3 text-sm"
                    value={pick[member.id] ?? ""}
                    onChange={(event) =>
                      setPick((prev) => ({ ...prev, [member.id]: event.target.value }))
                    }
                  >
                    <option value="">Välj spelare i truppen…</option>
                    {squad.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.number != null ? `#${player.number} ` : ""}
                        {player.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={!pick[member.id] || approve.isPending}
                    onClick={() =>
                      approve.mutate({
                        memberId: member.id,
                        playerId: pick[member.id] ?? null,
                      })
                    }
                  >
                    Godkänn
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button asChild variant="secondary">
        <Link to="/team/$teamId/trupp" params={{ teamId }}>
          <Users className="size-4" aria-hidden /> Till truppen
        </Link>
      </Button>
    </section>
  );
}
