import { useEffect, useState } from "react";
import { GAME_FORMATS } from "@/lib/game-format";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Copy, RefreshCw, Trash2 } from "lucide-react";
import { useConfirm } from "@/components/ConfirmDelete";
import { useTeamRole } from "@/hooks/useTeamRole";
import {
  deleteTeam,
  fetchTeam,
  fetchTeamCodes,
  fetchTeamImpact,
  rotateTeamCode,
  setTeamArchived,
  TEAM_GENDER_LABELS,
  updateTeam,
  uploadTeamMedia,
} from "@/lib/teams";
import { friendlyError } from "@/lib/user-errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/team/$teamId/about")({
  component: AboutPage,
});

function AboutPage() {
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/about" });
  const { isCoach, isOwner: canManageTeam, userId } = useTeamRole(teamId);
  const navigate = useNavigate();
  const { confirm, confirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const team = useQuery({ queryKey: ["team", teamId], queryFn: () => fetchTeam(teamId) });
  const codes = useQuery({
    queryKey: ["team-codes", teamId],
    queryFn: () => fetchTeamCodes(teamId),
    enabled: isCoach,
  });
  const impact = useQuery({
    queryKey: ["team-impact", teamId],
    queryFn: () => fetchTeamImpact(teamId),
    enabled: isCoach,
  });

  const [about, setAbout] = useState("");
  const [homeGround, setHomeGround] = useState("");
  const [name, setName] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [gameFormat, setGameFormat] = useState<string>("");
  const [gender, setGender] = useState("mixed");
  const [busy, setBusy] = useState(false);

  const isOwner = canManageTeam;
  const archived = Boolean(team.data?.archived_at);

  async function newCode(kind: "player" | "coach") {
    const ok = await confirm({
      title: kind === "coach" ? "Skapa ny tränarkod" : "Skapa ny lagkod",
      description:
        "Den gamla koden slutar fungera direkt. Alla som ska gå med behöver den nya koden.",
      confirmLabel: "Skapa ny kod",
      tone: "default",
    });
    if (!ok) return;
    try {
      await rotateTeamCode(teamId, kind);
      await queryClient.invalidateQueries({ queryKey: ["team-codes", teamId] });
      toast.success("Ny kod skapad");
    } catch (error) {
      toast.error(friendlyError(error, "Kunde inte skapa ny kod"));
    }
  }

  async function copyCode(code: string | undefined) {
    await navigator.clipboard.writeText(code ?? "");
    toast.success("Kod kopierad");
  }

  async function toggleArchive() {
    const ok = await confirm({
      title: archived ? "Återställ laget" : "Arkivera laget",
      description: archived
        ? "Laget blir aktivt igen och visas i listan över lag."
        : "Laget döljs i listan men all data finns kvar. Du kan återställa det när som helst.",
      confirmLabel: archived ? "Återställ" : "Arkivera",
      tone: "default",
    });
    if (!ok) return;
    await setTeamArchived(teamId, !archived);
    await queryClient.invalidateQueries({ queryKey: ["team", teamId] });
    await queryClient.invalidateQueries({ queryKey: ["teams"] });
    toast.success(archived ? "Laget är återställt" : "Laget är arkiverat");
  }

  async function removeTeam() {
    const ok = await confirm({
      title: "Radera laget permanent",
      description: impact.data
        ? `Detta raderas permanent: ${impact.data.players} spelare, ${impact.data.events} aktiviteter, ${impact.data.attendance} närvaroposter, ${impact.data.stats} statistikrader, ${impact.data.photos} bilder och ${impact.data.members} medlemskap. Det går inte att återskapa. Vill du bara dölja laget – arkivera i stället.`
        : "Spelare, kalender, närvaro och statistik för laget raderas och går inte att återskapa. Vill du bara dölja laget – arkivera i stället.",
      confirmLabel: "Radera laget",
      requireText: team.data?.name ?? "",
    });
    if (!ok) return;
    try {
      await deleteTeam(teamId);
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Laget är raderat");
      navigate({ to: "/teams" });
    } catch (error) {
      toast.error(friendlyError(error, "Kunde inte radera laget"));
    }
  }

  useEffect(() => {
    if (!team.data) return;
    setAbout(team.data.about ?? "");
    setHomeGround(team.data.home_ground ?? "");
    setName(team.data.name);
    setAgeGroup(team.data.age_group ?? "");
    setGameFormat(team.data.game_format ?? "");
    setGender(team.data.gender);
  }, [team.data]);

  async function save(file?: File | null) {
    setBusy(true);
    try {
      const photo_path =
        file && userId
          ? await uploadTeamMedia(teamId, file, "team")
          : (team.data?.photo_path ?? null);
      await updateTeam(teamId, {
        name,
        age_group: ageGroup || null,
        game_format: gameFormat || null,
        gender,
        about: about || null,
        home_ground: homeGround || null,
        photo_path,
      });
      await queryClient.invalidateQueries({ queryKey: ["team", teamId] });
      await queryClient.invalidateQueries({ queryKey: ["teams"] });
      toast.success("Sparat");
    } catch (error) {
      toast.error(friendlyError(error, "Kunde inte spara"));
    } finally {
      setBusy(false);
    }
  }

  if (!isCoach) {
    return (
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold">Om laget</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {team.data?.about || "Tränaren har inte lagt till någon beskrivning än."}
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-bold">Om laget</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs tracking-wide text-muted-foreground">
            Lagkod för spelare och föräldrar
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-2xl tracking-widest">
              {codes.data?.join_code ?? "······"}
            </span>
            <Button size="sm" variant="secondary" onClick={() => copyCode(codes.data?.join_code)}>
              <Copy className="size-4" aria-hidden /> Kopiera
            </Button>
            <Button size="sm" variant="ghost" onClick={() => newCode("player")}>
              <RefreshCw className="size-4" aria-hidden /> Ny kod
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Ger aldrig ledarbehörighet. Spelaren skickar en ansökan som du godkänner.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs tracking-wide text-muted-foreground">Tränarkod för nya ledare</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-2xl tracking-widest">
              {codes.data?.coach_join_code ?? "······"}
            </span>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => copyCode(codes.data?.coach_join_code)}
            >
              <Copy className="size-4" aria-hidden /> Kopiera
            </Button>
            <Button size="sm" variant="ghost" onClick={() => newCode("coach")}>
              <RefreshCw className="size-4" aria-hidden /> Ny kod
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Dela bara med personer som ska vara ledare. Ansökan måste godkännas av en tränare i
            laget.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="t-name">Lagnamn</Label>
        <Input id="t-name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-age">Åldersgrupp</Label>
        <Input id="t-age" value={ageGroup} onChange={(event) => setAgeGroup(event.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Spelform</Label>
        <div className="grid grid-cols-4 gap-2">
          {GAME_FORMATS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={gameFormat === item.id}
              onClick={() => setGameFormat(item.id)}
              className={`rounded-lg border px-2 py-2 text-sm ${
                gameFormat === item.id
                  ? "border-primary bg-primary/10 font-semibold"
                  : "border-border"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Taktiktavlan ritar planen efter lagets spelform.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(TEAM_GENDER_LABELS).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setGender(value)}
            className={`rounded-lg border px-2 py-2 text-sm ${
              gender === value
                ? "border-primary bg-primary/15"
                : "border-border text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-ground">Hemmaplan</Label>
        <Input
          id="t-ground"
          placeholder="T.ex. Långholmens IP"
          value={homeGround}
          onChange={(event) => setHomeGround(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-about">Beskrivning</Label>
        <Textarea
          id="t-about"
          rows={5}
          value={about}
          onChange={(event) => setAbout(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="t-photo">Lagbild</Label>
        <Input
          id="t-photo"
          type="file"
          accept="image/*"
          onChange={(event) => save(event.target.files?.[0] ?? null)}
        />
      </div>
      <Button onClick={() => save()} disabled={busy}>
        Spara
      </Button>

      {isOwner && (
        <div className="space-y-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <h3 className="text-sm font-semibold tracking-wide">Hantera laget</h3>
          <p className="text-sm text-muted-foreground">
            {archived
              ? "Laget är arkiverat och döljs i lagöversikten."
              : "Arkivera laget när säsongen är slut, eller radera det permanent."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={toggleArchive}>
              {archived ? (
                <ArchiveRestore className="size-4" aria-hidden />
              ) : (
                <Archive className="size-4" aria-hidden />
              )}
              {archived ? "Återställ laget" : "Arkivera laget"}
            </Button>
            <Button variant="destructive" onClick={removeTeam}>
              <Trash2 className="size-4" aria-hidden /> Radera laget
            </Button>
          </div>
        </div>
      )}
      {confirmDialog}
    </section>
  );
}
