import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pause, Play, Repeat } from "lucide-react";
import { fetchSharedTactic } from "@/lib/db";
import { interpolateFrames } from "@/lib/tactics";
import { Pitch } from "@/components/Pitch";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/t/$shareId")({
  head: () => ({
    meta: [
      { title: "Delad taktik – se spelmomentet animerat" },
      {
        name: "description",
        content: "Titta på ett delat spelmoment: spelarnas löpningar, passningar och tränarens anteckningar.",
      },
      { property: "og:title", content: "Delad taktik – se spelmomentet animerat" },
      { property: "og:description", content: "Titta på ett delat fotbollsmoment med löpningar och passningar." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SharedTactic,
});

const STEP_MS = 1400;

function SharedTactic() {
  const { shareId } = Route.useParams();
  const tactic = useQuery({ queryKey: ["shared", shareId], queryFn: () => fetchSharedTactic(shareId) });

  const frames = useMemo(() => tactic.data?.frames ?? [], [tactic.data]);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    let raf = 0;
    const startedAt = performance.now();
    const from = progress >= frames.length - 1 ? 0 : progress;
    const tick = (now: number) => {
      const value = from + (now - startedAt) / STEP_MS;
      if (value >= frames.length - 1) {
        setProgress(loop ? 0 : frames.length - 1);
        if (!loop) setPlaying(false);
        else {
          setPlaying(false);
          setTimeout(() => setPlaying(true), 60);
        }
        return;
      }
      setProgress(value);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, loop, frames.length]);

  if (tactic.isLoading) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Laddar taktik…</div>;
  }

  if (tactic.error || !tactic.data) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold">Taktiken är inte tillgänglig</h1>
          <p className="mt-2 text-sm text-muted-foreground">Länken kan ha slutat delas.</p>
          <Button asChild className="mt-4">
            <Link to="/">Till Taktiktavlan</Link>
          </Button>
        </div>
      </main>
    );
  }

  const segmentIndex = Math.min(Math.floor(progress), Math.max(frames.length - 2, 0));
  const frame = frames[segmentIndex];
  const objects = interpolateFrames(frames, progress);
  const passT = frames.length > 1 ? Math.min(Math.max(progress - segmentIndex, 0), 1) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-3 px-3 pb-8 pt-4">
      <header>
        <p className="text-xs tracking-widest text-muted-foreground">Delad taktik</p>
        <h1 className="font-display text-3xl font-bold">{tactic.data.name}</h1>
      </header>

      <Pitch
        pitchType={tactic.data.pitch_type}
        objects={objects}
        drawings={drawingsAtProgress(frames, progress)}
        interactive={false}
        passT={passT}
      />

      {frame?.note && (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm">{frame.note}</p>
      )}

      <section className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Föregående steg"
          onClick={() => {
            setPlaying(false);
            setProgress(Math.max(0, Math.round(progress) - 1));
          }}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          size="icon"
          aria-label={playing ? "Pausa" : "Spela upp"}
          onClick={() => setPlaying((value) => !value)}
          disabled={frames.length < 2}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Nästa steg"
          onClick={() => {
            setPlaying(false);
            setProgress(Math.min(frames.length - 1, Math.round(progress) + 1));
          }}
        >
          <ChevronRight className="size-4" />
        </Button>
        <Button
          variant={loop ? "default" : "ghost"}
          size="icon"
          aria-label="Loopa"
          onClick={() => setLoop((value) => !value)}
        >
          <Repeat className="size-4" />
        </Button>
        <input
          type="range"
          aria-label="Tidslinje"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          step={0.01}
          value={progress}
          disabled={frames.length < 2}
          onChange={(event) => {
            setPlaying(false);
            setProgress(Number(event.target.value));
          }}
          className="ml-2 w-full accent-[var(--color-primary)]"
        />
      </section>
    </main>
  );
}
