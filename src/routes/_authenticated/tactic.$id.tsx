import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Circle,
  CircleDot,
  ChevronLeft,
  ChevronRight,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FlipHorizontal2,
  MoveRight,
  Pause,
  Play,
  Plus,
  Repeat,
  Save,
  Redo2,
  Share2,
  Shield,
  Square,
  Trash2,
  Undo2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { fetchPlayers, fetchTactic, saveFrames, setTacticSharing } from "@/lib/db";
import { fetchTeamPlayers } from "@/lib/teams";
import { exportGif, exportVideo } from "@/lib/export-clip";
import { interpolateFrames, uid } from "@/lib/tactics";
import type { Drawing, FieldObject, Frame } from "@/lib/tactics";
import { Pitch, type Tool } from "@/components/Pitch";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";


export const Route = createFileRoute("/_authenticated/tactic/$id")({
  head: () => ({
    meta: [
      { title: "Taktiktavla – bygg och animera spelmoment" },
      {
        name: "description",
        content: "Placera spelare på planen, rita löpningar och passningar och animera taktiken steg för steg.",
      },
      { property: "og:title", content: "Taktiktavla – bygg och animera spelmoment" },
      { property: "og:description", content: "Placera spelare, rita löpningar och animera taktiken." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TacticEditor,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-center text-sm text-muted-foreground">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-center">Taktiken hittades inte.</div>,
});

const STEP_MS = 1400;
const MARK_COLORS = ["oklch(0.75 0.19 55)", "oklch(0.72 0.2 25)", "oklch(0.8 0.16 200)", "oklch(0.95 0 0)"];

function TacticEditor() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const tactic = useQuery({ queryKey: ["tactic", id], queryFn: () => fetchTactic(id) });
  const teamId = tactic.data?.team_id ?? null;
  const squad = useQuery({
    queryKey: ["team-players", teamId],
    queryFn: () => fetchTeamPlayers(teamId as string),
    enabled: !!teamId,
  });
  const personal = useQuery({ queryKey: ["players"], queryFn: fetchPlayers, enabled: !teamId });

  const bank: BankPlayer[] = useMemo(() => {
    if (teamId) {
      return (squad.data ?? []).map((player) => ({
        id: player.id,
        name: player.name,
        number: player.number,
        photoUrl: player.photoUrl,
        gk: player.is_goalkeeper,
      }));
    }
    return (personal.data ?? []).map((player) => ({
      id: player.id,
      name: player.name,
      number: player.number,
      photoUrl: player.photoUrl,
      gk: false,
    }));
  }, [teamId, squad.data, personal.data]);

  const [frames, setFrames] = useState<Frame[]>([]);
  const [current, setCurrent] = useState(0);
  const [tool, setTool] = useState<Tool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [hideNames, setHideNames] = useState(false);
  const [drawColor, setDrawColor] = useState(MARK_COLORS[0]!);

  const pastRef = useRef<Frame[][]>([]);
  const futureRef = useRef<Frame[][]>([]);
  const [historySize, setHistorySize] = useState({ past: 0, future: 0 });
  const [isPublic, setIsPublic] = useState(false);
  const [exporting, setExporting] = useState<null | "gif" | "video">(null);
  const framesRef = useRef<Frame[]>([]);
  const dragSession = useRef(false);
  framesRef.current = frames;

  useEffect(() => {
    if (tactic.data) {
      setFrames(tactic.data.frames);
      setCurrent(0);
      setProgress(0);
      setDirty(false);
      pastRef.current = [];
      futureRef.current = [];
      setHistorySize({ past: 0, future: 0 });
      setIsPublic(Boolean(tactic.data.is_public));
    }
  }, [tactic.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Inte inloggad");
      await saveFrames(id, user.id, frames);
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["tactics"] });
    },
    onError: () => toast.error("Kunde inte spara"),
  });

  const saveRef = useRef(save);
  saveRef.current = save;

  // Autosave with debounce
  useEffect(() => {
    if (!dirty) return;
    const timeout = setTimeout(() => saveRef.current.mutate(), 2000);
    return () => clearTimeout(timeout);
  }, [dirty, frames]);

  const pushHistory = useCallback(() => {
    pastRef.current = [...pastRef.current.slice(-49), framesRef.current];
    futureRef.current = [];
    setHistorySize({ past: pastRef.current.length, future: 0 });
  }, []);

  const commit = useCallback(
    (updater: (frames: Frame[]) => Frame[]) => {
      pushHistory();
      setFrames((prev) => updater(prev));
      setDirty(true);
    },
    [pushHistory],
  );

  // Playback
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    let raf = 0;
    const startedAt = performance.now();
    const from = progress >= frames.length - 1 ? 0 : progress;
    const total = ((frames.length - 1 - from) * STEP_MS) / speed;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const value = from + (elapsed / STEP_MS) * speed;
      if (value >= frames.length - 1) {
        if (loop) {
          setProgress(0);
          setPlaying(false);
          setTimeout(() => setPlaying(true), 60);
        } else {
          setProgress(frames.length - 1);
          setCurrent(frames.length - 1);
          setPlaying(false);
        }
        return;
      }
      setProgress(value);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    void total;
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, loop, frames.length]);

  const frame = frames[current];
  const scrubbing = Math.abs(progress - current) > 0.001;
  const animating = playing || scrubbing;
  const displayedObjects = useMemo(
    () => (animating ? interpolateFrames(frames, progress) : (frame?.objects ?? [])),
    [animating, frames, progress, frame],
  );
  const segmentIndex = Math.min(Math.floor(progress), Math.max(frames.length - 2, 0));
  const segmentT = progress - segmentIndex;
  const displayedDrawings = animating
    ? (frames[segmentIndex]?.drawings ?? [])
    : (frame?.drawings ?? []);
  const passT = animating && frames.length > 1 ? Math.min(Math.max(segmentT, 0), 1) : null;


  function addObject(object: FieldObject) {
    commit((prev) => prev.map((item) => ({ ...item, objects: [...item.objects, object] })));
  }

  function removeObject(objectId: string) {
    commit((prev) =>
      prev.map((item) => ({ ...item, objects: item.objects.filter((o) => o.id !== objectId) })),
    );
    setSelectedId(null);
  }

  function moveObject(objectId: string, x: number, y: number) {
    if (!dragSession.current) {
      dragSession.current = true;
      pushHistory();
    }
    setDirty(true);
    setFrames((prev) =>
      prev.map((item, index) =>
        index === current
          ? {
              ...item,
              objects: item.objects.map((o) => (o.id === objectId ? { ...o, x, y } : o)),
            }
          : item,
      ),
    );
  }

  function addDrawing(drawing: Omit<Drawing, "id">) {
    commit((prev) =>
      prev.map((item, index) =>
        index === current ? { ...item, drawings: [...item.drawings, { ...drawing, id: uid() }] } : item,
      ),
    );
  }

  function removeDrawing(drawingId: string) {
    commit((prev) =>
      prev.map((item, index) =>
        index === current
          ? { ...item, drawings: item.drawings.filter((d) => d.id !== drawingId) }
          : item,
      ),
    );
  }

  function addFrame() {
    commit((prev) => {
      const source = prev[current];
      if (!source) return prev;
      const copy: Frame = {
        id: uid(),
        name: `Steg ${prev.length + 1}`,
        objects: source.objects.map((object) => ({ ...object })),
        drawings: [],
      };
      const next = [...prev];
      next.splice(current + 1, 0, copy);
      return next;
    });
    setCurrent((value) => value + 1);
    setProgress(current + 1);
  }

  function deleteFrame(index: number) {
    if (frames.length <= 1) return;
    commit((prev) => prev.filter((_, i) => i !== index));
    setCurrent((value) => Math.max(0, Math.min(value, frames.length - 2)));
    setProgress((value) => Math.max(0, Math.min(value, frames.length - 2)));
  }

  function goToStep(index: number) {
    const next = Math.max(0, Math.min(index, frames.length - 1));
    setPlaying(false);
    setCurrent(next);
    setProgress(next);
  }

  const undo = useCallback(() => {
    const previous = pastRef.current[pastRef.current.length - 1];
    if (!previous) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [framesRef.current, ...futureRef.current.slice(0, 49)];
    setHistorySize({ past: pastRef.current.length, future: futureRef.current.length });
    setFrames(previous);
    setCurrent((value) => Math.min(value, previous.length - 1));
    setProgress((value) => Math.min(value, previous.length - 1));
    setDirty(true);
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current[0];
    if (!next) return;
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current.slice(-49), framesRef.current];
    setHistorySize({ past: pastRef.current.length, future: futureRef.current.length });
    setFrames(next);
    setCurrent((value) => Math.min(value, next.length - 1));
    setProgress((value) => Math.min(value, next.length - 1));
    setDirty(true);
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  function setNote(value: string) {
    setDirty(true);
    setFrames((prev) => prev.map((item, index) => (index === current ? { ...item, note: value } : item)));
  }

  const shareUrl =
    typeof window !== "undefined" && tactic.data?.share_id
      ? `${window.location.origin}/t/${tactic.data.share_id}`
      : "";

  const share = useMutation({
    mutationFn: async (next: boolean) => {
      await setTacticSharing(id, next);
      return next;
    },
    onSuccess: async (next) => {
      setIsPublic(next);
      queryClient.invalidateQueries({ queryKey: ["tactic", id] });
      if (next && shareUrl) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast.success("Delningslänk kopierad");
        } catch {
          toast.success("Taktiken delas nu via länk");
        }
      } else {
        toast.success("Delningen är avstängd");
      }
    },
    onError: () => toast.error("Kunde inte ändra delningen"),
  });

  async function runExport(kind: "gif" | "video") {
    if (!tactic.data) return;
    setExporting(kind);
    setPlaying(false);
    try {
      if (dirty) await save.mutateAsync();
      const filename = tactic.data.name.replace(/[^a-z0-9åäö]+/gi, "-").toLowerCase() || "taktik";
      const options = { frames, pitchType: tactic.data.pitch_type, stepMs: STEP_MS };
      if (kind === "gif") {
        await exportGif(options, filename);
        toast.success("GIF nedladdad");
      } else {
        const extension = await exportVideo(options, filename);
        toast.success(`Video nedladdad (.${extension})`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Exporten misslyckades");
    } finally {
      setExporting(null);
    }
  }

  function mirror() {
    commit((prev) =>
      prev.map((item, index) =>
        index === current
          ? {
              ...item,
              objects: item.objects.map((object) => ({ ...object, x: 1 - object.x })),
              drawings: item.drawings.map((drawing) => ({
                ...drawing,
                x1: 1 - drawing.x1,
                x2: 1 - drawing.x2,
              })),
            }
          : item,
      ),
    );
  }

  function clearPitch() {
    commit((prev) => prev.map((item) => ({ ...item, objects: [], drawings: [] })));
    setSelectedId(null);
  }

  if (tactic.isLoading || !tactic.data) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Laddar taktik…</div>;
  }

  const onPitchPlayerIds = new Set(
    (frame?.objects ?? []).map((object) => object.playerId).filter(Boolean) as string[],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-3 px-3 pb-6 pt-3">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka">
          <Link to="/">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-bold uppercase">
          {tactic.data.name}
        </h1>
        <span className="text-xs text-muted-foreground">
          {save.isPending ? "Sparar…" : dirty ? "Osparat" : "Sparat"}
        </span>
        <Button variant="ghost" size="icon" aria-label="Spara" onClick={() => save.mutate()}>
          <Save className="size-5" />
        </Button>
      </header>

      <Pitch
        pitchType={tactic.data.pitch_type}
        objects={displayedObjects}
        drawings={displayedDrawings}
        tool={tool}
        selectedId={selectedId}
        interactive={!playing}
        drawColor={tool === "zone" || tool === "circle" ? drawColor : undefined}
        passT={passT}
        onMoveObject={moveObject}
        onMoveEnd={() => {
          dragSession.current = false;
        }}
        onSelectObject={setSelectedId}
        onAddDrawing={addDrawing}
        onRemoveDrawing={removeDrawing}
      />

      <div className="flex flex-wrap items-center gap-2">
        <ToolButton active={tool === "select"} onClick={() => setTool("select")} label="Flytta">
          <MoveRight className="size-4" />
        </ToolButton>
        <ToolButton active={tool === "run"} onClick={() => setTool("run")} label="Löpning">
          <span className="text-xs font-semibold">Löpning</span>
        </ToolButton>
        <ToolButton active={tool === "pass"} onClick={() => setTool("pass")} label="Passning">
          <span className="text-xs font-semibold">Passning</span>
        </ToolButton>
        <ToolButton active={tool === "zone"} onClick={() => setTool("zone")} label="Zon">
          <Square className="size-4" />
        </ToolButton>
        <ToolButton active={tool === "circle"} onClick={() => setTool("circle")} label="Markering">
          <Circle className="size-4" />
        </ToolButton>
        <ToolButton active={tool === "erase"} onClick={() => setTool("erase")} label="Radera linjer">
          <Eraser className="size-4" />
        </ToolButton>

        {(tool === "zone" || tool === "circle") && (
          <div className="flex items-center gap-1" role="group" aria-label="Färg på markering">
            {MARK_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Färg ${color}`}
                onClick={() => setDrawColor(color)}
                className={`size-6 rounded-full border-2 ${
                  drawColor === color ? "border-foreground" : "border-transparent"
                }`}
                style={{ background: color }}
              />
            ))}
          </div>
        )}

        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Ångra" onClick={undo} disabled={historySize.past === 0}>
            <Undo2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Gör om" onClick={redo} disabled={historySize.future === 0}>
            <Redo2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Spegelvänd" onClick={mirror}>
            <FlipHorizontal2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Lägg till boll"
            onClick={() =>
              addObject({
                id: uid(),
                kind: "ball",
                label: "",
                team: "home",
                x: 0.5,
                y: 0.5,
              })
            }
          >
            <CircleDot className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Rensa plan" onClick={clearPitch}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      {selectedId && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <span>
            {frame?.objects.find((object) => object.id === selectedId)?.label || "Objekt"} markerad
          </span>
          <Button size="sm" variant="ghost" onClick={() => removeObject(selectedId)}>
            Ta bort från planen
          </Button>
        </div>
      )}

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary" className="w-full">
            <Users className="size-4" /> Spelarbank
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Sätt ut spelare</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 p-4 pt-0 sm:grid-cols-4">
            {(players.data ?? []).map((player) => {
              const used = onPitchPlayerIds.has(player.id);
              return (
                <button
                  key={player.id}
                  type="button"
                  disabled={used}
                  onClick={() =>
                    addObject({
                      id: uid(),
                      kind: "player",
                      playerId: player.id,
                      label: player.name.split(" ")[0] ?? player.name,
                      number: player.number,
                      team: player.team === "away" ? "away" : "home",
                      photoUrl: player.photoUrl,
                      x: 0.5,
                      y: 0.5,
                    })
                  }
                  className={`rounded-xl border border-border p-2 text-center text-xs ${
                    used ? "opacity-40" : "bg-card"
                  }`}
                >
                  <div
                    className="mx-auto grid size-12 place-items-center overflow-hidden rounded-full"
                    style={{
                      background:
                        player.team === "away" ? "var(--color-team-away)" : "var(--color-team-home)",
                      color:
                        player.team === "away"
                          ? "var(--color-team-away-foreground)"
                          : "var(--color-team-home-foreground)",
                    }}
                  >
                    {player.photoUrl ? (
                      <img src={player.photoUrl} alt={player.name} className="size-full object-cover" />
                    ) : (
                      <span className="font-display text-base font-bold">{player.number ?? "•"}</span>
                    )}
                  </div>
                  <p className="mt-1 truncate">{player.name}</p>
                </button>
              );
            })}
            {players.data?.length === 0 && (
              <p className="col-span-full text-center text-sm text-muted-foreground">
                Inga spelare än.{" "}
                <Link to="/bank" className="underline">
                  Fyll på banken
                </Link>
                .
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <section className="rounded-xl border border-border bg-card p-3">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="step-note">
          Anteckning för {frame?.name || `steg ${current + 1}`}
        </label>
        <Textarea
          id="step-note"
          rows={2}
          value={frame?.note ?? ""}
          onChange={(event) => setNote(event.target.value)}
          placeholder="T.ex. Ytterbacken går på överlapp när sexan vänder spelet."
          className="mt-2"
        />
        <p className="mt-1 text-xs text-muted-foreground">Visas under uppspelning och i delade länkar.</p>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Button
          variant={isPublic ? "default" : "secondary"}
          size="sm"
          onClick={() => share.mutate(!isPublic)}
          disabled={share.isPending}
        >
          <Share2 className="size-4" /> {isPublic ? "Delning på" : "Dela via länk"}
        </Button>
        {isPublic && shareUrl && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl).then(
                () => toast.success("Länk kopierad"),
                () => toast.error("Kunde inte kopiera"),
              );
            }}
            className="max-w-full truncate rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
          >
            {shareUrl}
          </button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => runExport("gif")} disabled={exporting !== null}>
            <Download className="size-4" /> {exporting === "gif" ? "Skapar GIF…" : "GIF"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => runExport("video")} disabled={exporting !== null}>
            <Download className="size-4" /> {exporting === "video" ? "Spelar in…" : "Video"}
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Föregående steg"
            onClick={() => goToStep(current - 1)}
            disabled={current === 0}
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
            onClick={() => goToStep(current + 1)}
            disabled={current >= frames.length - 1}
          >
            <ChevronRight className="size-4" />
          </Button>
          <button
            type="button"
            onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 0.5 : 1)}
            className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
          >
            {speed}x
          </button>
          <Button
            variant={loop ? "default" : "ghost"}
            size="icon"
            aria-label="Loopa"
            onClick={() => setLoop((value) => !value)}
          >
            <Repeat className="size-4" />
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">{frames.length} steg</span>
        </div>

        <input
          type="range"
          aria-label="Tidslinje"
          min={0}
          max={Math.max(frames.length - 1, 0)}
          step={0.01}
          value={progress}
          disabled={frames.length < 2}
          onChange={(event) => {
            const value = Number(event.target.value);
            setPlaying(false);
            setProgress(value);
            setCurrent(Math.round(value));
          }}
          className="mt-3 w-full accent-[var(--color-primary)]"
        />


        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {frames.map((item, index) => (
            <div
              key={item.id}
              className={`flex shrink-0 items-center gap-1 rounded-lg border px-3 py-2 text-sm ${
                index === current ? "border-primary bg-primary/15" : "border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => goToStep(index)}
                onDoubleClick={() => {
                  const value = window.prompt("Namn på steget", item.name ?? "");
                  if (value !== null) {
                    commit((prev) =>
                      prev.map((f, i) => (i === index ? { ...f, name: value } : f)),
                    );
                  }
                }}
              >
                {item.name || `Steg ${index + 1}`}
              </button>
              {frames.length > 1 && (
                <button
                  type="button"
                  aria-label="Ta bort steg"
                  onClick={() => deleteFrame(index)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          <Button variant="secondary" size="sm" className="shrink-0" onClick={addFrame}>
            <Plus className="size-4" /> Steg
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Flytta spelarna i varje steg – appen animerar mjukt mellan stegen. Dubbeltryck på ett steg för
          att döpa om det.
        </p>
      </section>
    </main>
  );
}

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-9 items-center gap-1 rounded-lg border px-3 ${
        active ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}
