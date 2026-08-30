import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  FlipHorizontal,
  Pause,
  Play,
  Repeat,
  Star,
} from "lucide-react";
import { Pitch } from "@/components/Pitch";
import { interpolateFrames } from "@/lib/tactics";
import {
  GAME_MOMENT_LABELS,
  PHASE_LABELS,
  ROLE_LABELS,
  SOURCE_TYPE_LABELS,
  addEventResource,
  addFavorite,
  cardToFrames,
  fetchFavorites,
  fetchTacticCard,
  label,
  removeFavorite,
} from "@/lib/taktikbank";
import { formatLabelFor } from "@/lib/rules-presentation";
import { fetchMyTeams, saveEvent } from "@/lib/teams";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";


export const Route = createFileRoute("/_authenticated/taktikbank/$cardId")({
  head: () => ({
    meta: [
      { title: "Taktikkort – animerat spelmoment" },
      {
        name: "description",
        content: "Se taktikkortet animerat med löpningar, passningar, coachfrågor och vanliga fel.",
      },
      { property: "og:title", content: "Taktikkort – animerat spelmoment" },
      { property: "og:description", content: "Animerat taktikkort med coachstöd för barnfotboll." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TaktikbankCard,
});

const STEP_MS = 1500;

function TaktikbankCard() {
  const { cardId } = Route.useParams();
  const { isCoach, isAdmin, loading } = useAccount();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const allowed = isCoach || isAdmin;
  const card = useQuery({
    queryKey: ["tb-tactic", cardId],
    queryFn: () => fetchTacticCard(cardId),
    enabled: allowed,
  });
  const favorites = useQuery({ queryKey: ["tb-favorites"], queryFn: fetchFavorites, enabled: allowed });
  const teams = useQuery({ queryKey: ["my-teams"], queryFn: fetchMyTeams, enabled: allowed });

  const [mirrored, setMirrored] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [loopPause, setLoopPause] = useState(0.6);
  const [planOpen, setPlanOpen] = useState(false);

  const isFavorite = (favorites.data ?? []).some(
    (item) => item.kind === "tactic" && item.resource_id === cardId,
  );

  const toggleFavorite = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Inte inloggad");
      if (isFavorite) await removeFavorite(user.id, "tactic", cardId);
      else await addFavorite(user.id, "tactic", cardId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tb-favorites"] });
      toast.success(isFavorite ? "Borttagen från favoriter" : "Sparad som favorit");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const frames = useMemo(
    () => (card.data ? cardToFrames(card.data.data, mirrored) : []),
    [card.data, mirrored],
  );

  useEffect(() => {
    setProgress(0);
  }, [cardId, mirrored]);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let startedAt = performance.now();
    let from = progress >= frames.length - 1 ? 0 : progress;
    const tick = (now: number) => {
      const value = from + ((now - startedAt) / STEP_MS) * speed;
      if (value >= frames.length - 1) {
        setProgress(frames.length - 1);
        if (!loop) {
          setPlaying(false);
          return;
        }
        timer = setTimeout(() => {
          setProgress(0);
          from = 0;
          startedAt = performance.now();
          raf = requestAnimationFrame(tick);
        }, loopPause * 1000);
        return;
      }
      setProgress(value);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, loop, loopPause, speed, frames.length]);


  if (loading || card.isLoading) {
    return <main className="grid min-h-screen place-items-center text-muted-foreground">Laddar…</main>;
  }

  if (!allowed) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
        Taktikbanken är till för tränare och lagledare.
      </main>
    );
  }

  if (!card.data) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center text-muted-foreground">
        Kortet kunde inte hittas.
      </main>
    );
  }

  const data = card.data.data;
  const objects = interpolateFrames(frames, progress);
  const index = Math.min(frames.length - 1, Math.round(progress));
  const note = frames[index]?.note;
  const passT = progress - Math.floor(progress);
  const pitchType = data.format === "11v11" ? "full" : "small";

  return (
    <main className="mx-auto max-w-3xl px-4 pb-24 pt-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka">
          <Link to="/taktikbank">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xs uppercase tracking-[0.25em] text-primary">
            {formatLabelFor(data.format)} · {label(GAME_MOMENT_LABELS, data.gameMoment)} · {label(PHASE_LABELS, data.phase)}
          </p>
          <h1 className="truncate font-display text-2xl font-bold uppercase">{data.title}</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={isFavorite ? "Ta bort favorit" : "Spara som favorit"}
          disabled={toggleFavorite.isPending}
          onClick={() => toggleFavorite.mutate()}
        >
          <Star className={isFavorite ? "size-5 fill-primary text-primary" : "size-5"} />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPlanOpen(true)}>
          <CalendarPlus className="mr-1 size-4" /> Träning
        </Button>
      </header>


      <p className="mt-3 text-sm text-muted-foreground">{data.purpose}</p>

      <div className="mt-4 rounded-xl border border-border bg-card p-3">
        <Pitch
          pitchType={pitchType}
          objects={objects}
          drawings={frames[index]?.drawings ?? []}
          interactive={false}
          passT={passT}
        />

        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Föregående steg"
            onClick={() => {
              setPlaying(false);
              setProgress((value) => Math.max(0, Math.round(value) - 1));
            }}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <Button size="icon" aria-label={playing ? "Pausa" : "Spela"} onClick={() => setPlaying((v) => !v)}>
            {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Nästa steg"
            onClick={() => {
              setPlaying(false);
              setProgress((value) => Math.min(frames.length - 1, Math.round(value) + 1));
            }}
          >
            <ChevronRight className="size-5" />
          </Button>
          <input
            type="range"
            className="h-2 flex-1 accent-primary"
            min={0}
            max={Math.max(0, frames.length - 1)}
            step={0.01}
            value={progress}
            aria-label="Tidslinje"
            onChange={(event) => {
              setPlaying(false);
              setProgress(Number(event.target.value));
            }}
          />
          <Button
            variant={loop ? "default" : "ghost"}
            size="icon"
            aria-label="Upprepa"
            onClick={() => setLoop((v) => !v)}
          >
            <Repeat className="size-5" />
          </Button>
          <Button
            variant={mirrored ? "default" : "ghost"}
            size="icon"
            aria-label="Spegelvänd"
            onClick={() => setMirrored((v) => !v)}
          >
            <FlipHorizontal className="size-5" />
          </Button>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-24 shrink-0">Hastighet {speed.toFixed(2)}x</span>
            <input
              type="range"
              className="h-2 flex-1 accent-primary"
              min={0.25}
              max={2}
              step={0.05}
              value={speed}
              aria-label="Animationshastighet"
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-24 shrink-0">Paus vid upprepning {loopPause.toFixed(1)} s</span>
            <input
              type="range"
              className="h-2 flex-1 accent-primary"
              min={0}
              max={3}
              step={0.1}
              value={loopPause}
              disabled={!loop}
              aria-label="Paus mellan repetitioner"
              onChange={(event) => setLoopPause(Number(event.target.value))}
            />
          </label>
        </div>

        <p className="mt-2 min-h-10 rounded-lg bg-muted/40 px-3 py-2 text-sm">
          <span className="text-muted-foreground">Steg {index + 1}/{frames.length}: </span>
          {note ?? "—"}
        </p>
      </div>

      <PlanTrainingDialog
        open={planOpen}
        onOpenChange={setPlanOpen}
        cardId={cardId}
        cardTitle={data.title}
        purpose={data.purpose ?? ""}
        teams={teams.data ?? []}
        userId={user?.id ?? null}
        onCreated={(teamId) => {
          setPlanOpen(false);
          navigate({ to: "/team/$teamId/training", params: { teamId } });
        }}
      />


      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        <Info title="Startsignal" body={data.trigger} />
        <Info title="Barnfras" body={data.childCue} />
        <Info title="Tränarfråga" body={data.coachQuestion} />
        <Info title="Beslutsregel" body={data.decisionRule} />
        <Info title="Vanligt fel" body={data.commonError} />
        <Info title="Rättning" body={data.correction} />
        <Info title="Tecken på att det funkar" body={data.successSign} />
        <Info title="Svårighetsgrad" body={`Nivå ${data.difficulty}`} />
      </section>

      {data.roleActions?.length ? (
        <section className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-display text-sm uppercase tracking-wide text-muted-foreground">Roller</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.roleActions.map((role) => (
              <li key={role.roleId}>
                <span className="font-medium">{label(ROLE_LABELS, role.roleId)}:</span> {role.action}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.sources?.length ? (
        <section className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-display text-sm uppercase tracking-wide text-muted-foreground">Källor</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.sources.map((source) => (
              <li key={source.title}>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer" className="text-primary underline">
                    {source.title}
                  </a>
                ) : (
                  source.title
                )}
                <span className="text-muted-foreground"> · {label(SOURCE_TYPE_LABELS, source.sourceType)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function Info({ title, body }: { title: string; body?: string | null | undefined }) {
  if (!body) return null;
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-display text-xs uppercase tracking-wide text-muted-foreground">{title}</h2>
      <p className="mt-1 text-sm">{body}</p>
    </article>
  );
}

function PlanTrainingDialog({
  open,
  onOpenChange,
  cardId,
  cardTitle,
  purpose,
  teams,
  userId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  cardId: string;
  cardTitle: string;
  purpose: string;
  teams: Awaited<ReturnType<typeof fetchMyTeams>>;
  userId: string | null;
  onCreated: (teamId: string) => void;
}) {
  const [teamId, setTeamId] = useState("");
  const [date, setDate] = useState("");
  const [from, setFrom] = useState("18:00");
  const [to, setTo] = useState("19:30");
  const [notes, setNotes] = useState(purpose);

  useEffect(() => {
    if (open && !teamId && teams[0]) setTeamId(teams[0].id);
  }, [open, teams, teamId]);

  const team = teams.find((item) => item.id === teamId);

  const create = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Inte inloggad");
      if (!teamId) throw new Error("Välj ett lag");
      if (!date) throw new Error("Välj datum");
      const eventId = await saveEvent({
        teamId,
        userId,
        type: "training",
        title: cardTitle,
        starts_at: new Date(`${date}T${from}`).toISOString(),
        ends_at: to ? new Date(`${date}T${to}`).toISOString() : null,
        location: team?.home_ground ?? null,
        notes: notes || null,
      });
      if (eventId) {
        await addEventResource({ eventId, teamId, userId, kind: "tactic", resourceId: cardId });
      }
    },
    onSuccess: () => {
      toast.success("Träningstillfälle skapat");
      onCreated(teamId);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Skapa träning från kortet</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="plan-team">Lag</Label>
            <select
              id="plan-team"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
            >
              <option value="">Välj lag…</option>
              {teams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="plan-date">Datum</Label>
              <Input id="plan-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-from">Från</Label>
              <Input id="plan-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="plan-to">Till</Label>
              <Input id="plan-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="plan-notes">Övrigt</Label>
            <Textarea id="plan-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button className="w-full" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Skapar…" : "Skapa träning"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
