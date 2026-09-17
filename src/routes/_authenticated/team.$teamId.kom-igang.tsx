import { useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarPlus, Check, Copy, MailCheck, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTeamRole } from "@/hooks/useTeamRole";
import {
  approveTeamJoinRequest,
  fetchEvents,
  fetchTeam,
  fetchTeamCodes,
  fetchTeamMembers,
  fetchTeamPlayers,
  formatDateTime,
  saveTeamPlayer,
} from "@/lib/teams";
import { fetchTeamInviteCounts } from "@/lib/invitations";
import { buildTeamInviteUrl, shareOrigin } from "@/lib/invite-links";
import { copyText } from "@/lib/copy-text";
import { isGuardianOnlyTeam } from "@/lib/team-age";
import {
  nextStartStep,
  responsesText,
  startProgressText,
  startStepsDone,
  type StartProgressInput,
} from "@/lib/team-onboarding";
import { friendlyError } from "@/lib/user-errors";

export const Route = createFileRoute("/_authenticated/team/$teamId/kom-igang")({
  head: () => ({
    meta: [
      { title: "Kom igång med laget – Fotbollsrummet" },
      {
        name: "description",
        content:
          "Trupp, inbjudan, godkännanden, första aktiviteten och svaren på kallelsen – i fem steg.",
      },
      { property: "og:title", content: "Kom igång med laget – Fotbollsrummet" },
      {
        property: "og:description",
        content: "Från tom trupp till spelad match med svar från familjerna.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StartPage,
});

function StepCard({
  step,
  title,
  done,
  active,
  children,
}: {
  step: number;
  title: string;
  done: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        active ? "border-primary bg-card" : "border-border bg-card"
      }`}
    >
      <p className="font-display text-lg font-bold">
        Steg {step} · {title} {done && <Check className="inline size-5 text-primary" aria-hidden />}
      </p>
      {children}
    </div>
  );
}

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
  const events = useQuery({
    queryKey: ["team-events", teamId],
    queryFn: () => fetchEvents(teamId),
    enabled: isCoach,
  });
  const inviteCounts = useQuery({
    queryKey: ["team-invite-counts", teamId],
    queryFn: () => fetchTeamInviteCounts(teamId),
    enabled: isCoach,
  });

  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [pick, setPick] = useState<Record<string, string>>({});

  const guardianOnly = isGuardianOnlyTeam(team.data);
  const squad = players.data ?? [];
  const allMembers = members.data ?? [];
  const families = allMembers.filter(
    (member) => member.role === "guardian" || member.role === "player",
  );
  const pending = allMembers.filter((member) => member.status === "pending");
  const inviteUrl = codes.data?.join_code
    ? buildTeamInviteUrl(shareOrigin(), codes.data.join_code)
    : "";

  const now = Date.now();
  const upcoming = (events.data ?? [])
    .filter((event) => !event.cancelled_at && new Date(event.starts_at).getTime() >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const counts = Object.values(inviteCounts.data ?? {});
  const invitesTotal = counts.reduce((sum, item) => sum + item.total, 0);
  const invitesAnswered = counts.reduce((sum, item) => sum + item.answered, 0);

  const progress: StartProgressInput = {
    players: squad.length,
    families: families.length,
    approvedFamilies: families.filter((member) => member.status === "approved").length,
    upcomingEvents: upcoming.length,
    invitesTotal,
    invitesAnswered,
  };
  const done = startStepsDone(progress);
  const active = nextStartStep(progress);

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

  // Barnet står ofta inte i truppen när familjen ansöker – då skapar vi
  // spelaren från namnet familjen angav och kopplar kontot direkt.
  const addAndApprove = useMutation({
    mutationFn: async ({ memberId, playerName }: { memberId: string; playerName: string }) => {
      if (!userId) throw new Error("Du måste vara inloggad.");
      const player = await saveTeamPlayer({
        teamId,
        userId,
        name: playerName.trim(),
        number: null,
        birth_date: null,
        gender: null,
        is_goalkeeper: false,
        photo_path: null,
      });
      await approveTeamJoinRequest(memberId, player.id);
    },
    onSuccess: async () => {
      toast.success("Godkänd och kopplad till truppen.");
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
          Fem steg – från tom trupp till spelad match med svar från familjerna. Du kan hoppa över
          och fortsätta senare; sidan finns kvar under Översikt.
        </p>
        <p className="mt-2 text-sm font-semibold text-primary">{startProgressText(progress)}</p>
      </div>

      <StepCard step={1} title="Lägg in truppen" done={done.squad} active={active === "squad"}>
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
      </StepCard>

      <StepCard step={2} title="Dela inbjudan" done={done.invite} active={active === "invite"}>
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
              const ok = await copyText(inviteUrl);
              toast[ok ? "success" : "error"](
                ok
                  ? "Inbjudningslänken är kopierad"
                  : "Kopieringen gick inte – markera länken och kopiera den själv.",
              );
            }}
          >
            <Copy className="size-4" aria-hidden /> Kopiera länk
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Lagkod: <span className="font-mono">{codes.data?.join_code ?? "······"}</span>
        </p>
        {families.length > 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            {families.length} {families.length === 1 ? "familj har" : "familjer har"} använt länken.
          </p>
        ) : (
          <p className="mt-2 text-sm font-semibold text-destructive">
            Ingen familj har använt länken ännu. Dela den i lagchatten eller via SMS.
          </p>
        )}

      </StepCard>

      <StepCard
        step={3}
        title="Godkänn familjerna"
        done={done.approve}
        active={active === "approve"}
      >
        {pending.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {done.approve
              ? "Alla ansökningar är godkända."
              : "Inga ansökningar just nu. De dyker upp här när familjerna har klickat på länken."}
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
                    <option value="">Koppla till spelare senare</option>
                    {squad.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.number != null ? `#${player.number} ` : ""}
                        {player.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    disabled={approve.isPending}
                    onClick={() =>
                      approve.mutate({
                        memberId: member.id,
                        playerId: pick[member.id] || null,
                      })
                    }
                  >
                    Godkänn
                  </Button>
                  {/* Står barnet inte i truppen ännu slipper tränaren byta sida för att lägga in det. */}
                  {member.guardianForName &&
                    !squad.some(
                      (player) =>
                        player.name.trim().toLowerCase() ===
                        member.guardianForName?.trim().toLowerCase(),
                    ) && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={approve.isPending || addAndApprove.isPending}
                        onClick={() =>
                          addAndApprove.mutate({
                            memberId: member.id,
                            playerName: member.guardianForName as string,
                          })
                        }
                      >
                        <Plus className="size-4" aria-hidden /> Lägg till {member.guardianForName} i
                        truppen och godkänn
                      </Button>
                    )}
                </div>
                {squad.length === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Truppen är tom. Du kan godkänna nu och koppla barnet till truppen senare.
                  </p>
                )}

              </li>
            ))}
          </ul>
        )}
      </StepCard>

      <StepCard
        step={4}
        title="Planera första träningen eller matchen"
        done={done.plan}
        active={active === "plan"}
      >
        <p className="mt-1 text-sm text-muted-foreground">
          Lägg in tid, samling och plats. Familjerna ser aktiviteten i kalendern direkt.
        </p>
        {upcoming.length === 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/team/$teamId/training" params={{ teamId }}>
                <CalendarPlus className="size-4" aria-hidden /> Ny träning
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link to="/team/$teamId/matches" params={{ teamId }}>
                <CalendarPlus className="size-4" aria-hidden /> Ny match
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.slice(0, 3).map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"
              >
                <span>
                  <span className="font-medium">
                    {event.title ??
                      (event.type === "match"
                        ? `${event.home_team ?? "Hemmalag"} – ${event.away_team ?? "Bortalag"}`
                        : "Träning")}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {formatDateTime(event.starts_at)}
                    {event.location ? ` · ${event.location}` : ""}
                  </span>
                </span>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/team/$teamId/event/$eventId" params={{ teamId, eventId: event.id }}>
                    Öppna
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </StepCard>

      <StepCard
        step={5}
        title="Skicka kallelsen och följ svaren"
        done={done.responses}
        active={active === "responses"}
      >
        <p className="mt-1 text-sm text-muted-foreground">
          {guardianOnly
            ? "Vårdnadshavarna svarar för sina barn, i appen och via mejl."
            : "Spelarna och vårdnadshavarna svarar i appen och via mejl."}
        </p>
        <p
          className={`mt-2 text-sm ${
            invitesTotal === 0 ? "font-semibold text-destructive" : "text-muted-foreground"
          }`}
        >
          {responsesText(invitesTotal, invitesAnswered)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link to="/team/$teamId/calendar" params={{ teamId }}>
              <MailCheck className="size-4" aria-hidden /> Till aktiviteterna
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to="/kalender/kallelser">Alla kallelser och svar</Link>
          </Button>
        </div>
      </StepCard>

      <Button asChild variant="secondary">
        <Link to="/team/$teamId/trupp" params={{ teamId }}>
          <Users className="size-4" aria-hidden /> Till truppen
        </Link>
      </Button>
    </section>
  );
}
