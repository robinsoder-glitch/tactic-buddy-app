import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
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
import { BackIconButton } from "@/components/BackLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RelatedContent } from "@/components/RelatedContent";
import { AddToTrainingButton } from "@/components/AddToTrainingDialog";
import { useRelatedContent } from "@/hooks/useRelatedContent";
import { TACTIC_SECTIONS } from "@/lib/related-sections";

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
  const favorites = useQuery({
    queryKey: ["tb-favorites"],
    queryFn: fetchFavorites,
    enabled: allowed,
  });
  const teams = useQuery({ queryKey: ["my-teams"], queryFn: fetchMyTeams, enabled: allowed });

  const [mirrored, setMirrored] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [loopPause, setLoopPause] = useState(0.6);

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

  const relatedSectionList = useRelatedContent({ type: "tactic", id: cardId }, TACTIC_SECTIONS);

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
    return (
      <main className="grid min-h-dvh place-items-center text-muted-foreground">Laddar…</main>
    );
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
        <BackIconButton fallback="/taktikbank" label="Tillbaka" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xs tracking-[0.25em] text-primary">
            {formatLabelFor(data.format)} · {label(GAME_MOMENT_LABELS, data.gameMoment)} ·{" "}
            {label(PHASE_LABELS, data.phase)}
          </p>
          <h1 className="truncate font-display text-2xl font-bold">{data.title}</h1>
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
          <Button
            size="icon"
            aria-label={playing ? "Pausa" : "Spela"}
            onClick={() => setPlaying((v) => !v)}
          >
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
          <span className="text-muted-foreground">
            Steg {index + 1}/{frames.length}:{" "}
          </span>
          {note ?? "—"}
        </p>
      </div>

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
          <h2 className="font-display text-sm tracking-wide text-muted-foreground">Roller</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.roleActions.map((role) => (
              <li key={role.roleId}>
                <span className="font-medium">{label(ROLE_LABELS, role.roleId)}:</span>{" "}
                {role.action}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.sources?.length ? (
        <section className="mt-4 rounded-xl border border-border bg-card p-4">
          <h2 className="font-display text-sm tracking-wide text-muted-foreground">Källor</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.sources.map((source) => (
              <li key={source.title}>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline"
                  >
                    {source.title}
                  </a>
                ) : (
                  source.title
                )}
                <span className="text-muted-foreground">
                  {" "}
                  · {label(SOURCE_TYPE_LABELS, source.sourceType)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-4">
        <AddToTrainingButton
          kind="tactic"
          resourceId={cardId}
          title={data.title}
          defaultMinutes={15}
          size="sm"
        />
      </div>

      <RelatedContent sections={relatedSectionList} />
    </main>
  );
}

function Info({ title, body }: { title: string; body?: string | null | undefined }) {
  if (!body) return null;
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <h2 className="font-display text-xs tracking-wide text-muted-foreground">{title}</h2>
      <p className="mt-1 text-sm">{body}</p>
    </article>
  );
}
