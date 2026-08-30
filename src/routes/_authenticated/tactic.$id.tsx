import { loadPrefs, type AppPrefs } from "@/lib/prefs";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CircleDot,
  Grid3x3,
  ChevronLeft,
  ChevronRight,
  Download,
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
import { exportGif, exportVideo, QUALITY_PRESETS } from "@/lib/export-clip";
import { ExportDialog } from "@/components/ExportDialog";
import type { ExportSettings } from "@/components/ExportDialog";
import { downloadTacticFile } from "@/lib/tactic-file";
import { interpolateFrames, uid } from "@/lib/tactics";
import {
  entry as historyEntry,
  loadHistory,
  saveHistory,
  type HistoryEntry,
} from "@/lib/tactic-history";
import type { Drawing, FieldObject, Frame } from "@/lib/tactics";
import { Pitch, type Tool } from "@/components/Pitch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
const GRID_FALLBACK = 0.05;
const FINE_STEP = 0.01;
const MARK_COLORS = ["oklch(0.75 0.19 55)", "oklch(0.72 0.2 25)", "oklch(0.8 0.16 200)", "oklch(0.95 0 0)"];

function historyMeta(past: HistoryEntry[], future: HistoryEntry[]) {
  return {
    past: past.length,
    future: future.length,
    undoLabel: past[past.length - 1]?.label ?? "",
    redoLabel: future[0]?.label ?? "",
  };
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const rest = safe - mins * 60;
  return `${mins}:${rest.toFixed(1).padStart(4, "0")}`;
}

type BankPlayer = {
  id: string;
  name: string;
  number: number | null;
  photoUrl: string | null;
  gk: boolean;
};


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
  const [speed, setSpeed] = useState(() => loadPrefs().speed);
  const [loop, setLoop] = useState(() => loadPrefs().loop);
  const [prefs] = useState<AppPrefs>(() => loadPrefs());
  const gridStep = prefs.gridStep || GRID_FALLBACK;
  const [progress, setProgress] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [hideNames, setHideNames] = useState(() => loadPrefs().hideNames);
  const [snap, setSnap] = useState(true);
  const [drawColor, setDrawColor] = useState(MARK_COLORS[0]!);

  const pastRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const [historySize, setHistorySize] = useState({ past: 0, future: 0, undoLabel: "", redoLabel: "" });

  const [isPublic, setIsPublic] = useState(false);
  const [exporting, setExporting] = useState<null | "gif" | "video">(null);
  const framesRef = useRef<Frame[]>([]);
  const dragSession = useRef(false);
  framesRef.current = frames;

  useEffect(() => {
    if (tactic.data) {
      setFrames(
        tactic.data.frames.map((item) => {
          let ballSeen = false;
          return {
            ...item,
            objects: item.objects.filter((object) => {
              if (object.kind !== "ball") return true;
              if (ballSeen) return false;
              ballSeen = true;
              return true;
            }),
          };
        }),
      );
      setCurrent(0);
      setProgress(0);
      setDirty(false);
      const stored = loadHistory(id);
      pastRef.current = stored.past;
      futureRef.current = stored.future;
      setHistorySize(historyMeta(stored.past, stored.future));
      setIsPublic(Boolean(tactic.data.is_public));
    }
  }, [tactic.data, id]);

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

  const persistHistory = useCallback(() => {
    saveHistory(id, { past: pastRef.current, future: futureRef.current });
    setHistorySize(historyMeta(pastRef.current, futureRef.current));
  }, [id]);

  const pushHistory = useCallback(
    (label = "Ändring") => {
      pastRef.current = [...pastRef.current.slice(-29), historyEntry(label, framesRef.current)];
      futureRef.current = [];
      persistHistory();
    },
    [persistHistory],
  );

  const commit = useCallback(
    (updater: (frames: Frame[]) => Frame[], label = "Ändring") => {
      pushHistory(label);
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

  // Autostart playback when the user has enabled it in settings
  const autoplayed = useRef(false);
  useEffect(() => {
    if (autoplayed.current || !prefs.autoplay || frames.length < 2) return;
    autoplayed.current = true;
    setProgress(0);
    setCurrent(0);
    setPlaying(true);
  }, [prefs.autoplay, frames.length]);

  const frame = frames[current];
  const hasBall = (frame?.objects ?? []).some((object) => object.kind === "ball");
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
    commit(
      (prev) => prev.map((item) => ({ ...item, objects: [...item.objects, object] })),
      "Lade till objekt",
    );
  }

  function removeObject(objectId: string) {
    commit((prev) =>
      prev.map((item) => ({ ...item, objects: item.objects.filter((o) => o.id !== objectId) })),
      "Tog bort objekt",
    );
    setSelectedId(null);
  }

  function updateObject(objectId: string, patch: Partial<FieldObject>) {
    commit((prev) =>
      prev.map((item) => ({
        ...item,
        objects: item.objects.map((o) => (o.id === objectId ? { ...o, ...patch } : o)),
      })),
    );
  }


  function snapValue(value: number) {
    const clamped = Math.min(0.98, Math.max(0.02, value));
    return snap ? Math.round(clamped / gridStep) * gridStep : clamped;
  }

  function moveObject(objectId: string, rawX: number, rawY: number) {
    const x = snapValue(rawX);
    const y = snapValue(rawY);
    if (!dragSession.current) {
      dragSession.current = true;
      pushHistory("Flyttade objekt");
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

  // Dragging with the run/pass tool: object already moved via moveObject (history pushed at drag start),
  // so here we only append the trail line in the same undo step.
  function objectTrail(objectId: string, type: "run" | "pass", from: { x: number; y: number }) {
    const currentFrame = framesRef.current[current];
    const object = currentFrame?.objects.find((item) => item.id === objectId);
    if (!object) return;
    const x1 = snapValue(from.x);
    const y1 = snapValue(from.y);
    const distance = Math.hypot(object.x - x1, object.y - y1);
    if (distance < 0.02) return;
    setDirty(true);
    setFrames((prev) =>
      prev.map((item, index) =>
        index === current
          ? {
              ...item,
              drawings: [
                ...item.drawings,
                { id: uid(), type, color: null, x1, y1, x2: object.x, y2: object.y },
              ],
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
      "Ritade markering",
    );
  }

  function removeDrawing(drawingId: string) {
    commit((prev) =>
      prev.map((item, index) =>
        index === current
          ? { ...item, drawings: item.drawings.filter((d) => d.id !== drawingId) }
          : item,
      ),
      "Tog bort markering",
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
      return renumber(next);
    }, "Nytt steg");
    setCurrent((value) => value + 1);
    setProgress(current + 1);
  }

  // Keep auto-generated step names ("Steg N") sequential after add/remove; custom names are untouched
  function renumber(list: Frame[]) {
    return list.map((item, index) =>
      item.name && /^Steg \d+$/.test(item.name) ? { ...item, name: `Steg ${index + 1}` } : item,
    );
  }

  function deleteFrame(index: number) {
    if (frames.length <= 1) return;
    if (prefs.confirmDelete && !window.confirm("Ta bort det här steget?")) return;
    commit((prev) => renumber(prev.filter((_, i) => i !== index)), "Tog bort steg");
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
    futureRef.current = [
      historyEntry(previous.label, framesRef.current),
      ...futureRef.current.slice(0, 29),
    ];
    persistHistory();
    setFrames(previous.frames);
    setCurrent((value) => Math.min(value, previous.frames.length - 1));
    setProgress((value) => Math.min(value, previous.frames.length - 1));
    setDirty(true);
  }, [persistHistory]);

  const redo = useCallback(() => {
    const next = futureRef.current[0];
    if (!next) return;
    futureRef.current = futureRef.current.slice(1);
    pastRef.current = [...pastRef.current.slice(-29), historyEntry(next.label, framesRef.current)];
    persistHistory();
    setFrames(next.frames);
    setCurrent((value) => Math.min(value, next.frames.length - 1));
    setProgress((value) => Math.min(value, next.frames.length - 1));
    setDirty(true);
  }, [persistHistory]);

  const nudge = useCallback(
    (dx: number, dy: number) => {
      if (!selectedId) return;
      pushHistory("Finjusterade position");
      setDirty(true);
      setFrames((prev) =>
        prev.map((item, index) =>
          index === current
            ? {
                ...item,
                objects: item.objects.map((o) =>
                  o.id === selectedId
                    ? {
                        ...o,
                        x: Math.min(0.98, Math.max(0.02, o.x + dx)),
                        y: Math.min(0.98, Math.max(0.02, o.y + dy)),
                      }
                    : o,
                ),
              }
            : item,
        ),
      );
    },
    [selectedId, current, pushHistory],
  );

  useEffect(() => {
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    function onArrow(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      const direction = arrows[event.key];
      if (direction && selectedId) {
        event.preventDefault();
        const step = event.shiftKey ? gridStep : FINE_STEP;
        nudge(direction[0] * step, direction[1] * step);
        return;
      }
      // No object selected: arrows scrub the timeline
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const sign = event.key === "ArrowRight" ? 1 : -1;
        seekRef.current(sign, event.shiftKey);
        return;
      }
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        seekRef.current(event.key === "Home" ? -Infinity : Infinity, true);
      }
    }
    window.addEventListener("keydown", onArrow);
    return () => window.removeEventListener("keydown", onArrow);
  }, [nudge, selectedId]);

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

  async function runExport(settings: ExportSettings) {
    if (!tactic.data) return;
    const kind = settings.format;
    setExporting(kind);
    setPlaying(false);
    try {
      if (dirty) await save.mutateAsync();
      const filename = tactic.data.name.replace(/[^a-z0-9åäö]+/gi, "-").toLowerCase() || "taktik";
      const preset = QUALITY_PRESETS[settings.quality];
      const options = {
        frames,
        pitchType: tactic.data.pitch_type,
        stepMs: STEP_MS / speed,
        fps: settings.fps,
        width: preset.width,
        colors: preset.colors,
        bitrate: preset.bitrate,
        hideNames,
        tokenScale: prefs.playerScale,
        showPhotos: prefs.showPhotos,
      };
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

  function addFreePlayer(team: "home" | "away", gk: boolean, x?: number, y?: number) {
    const existing = (frame?.objects ?? []).filter(
      (object) => object.kind === "player" && object.team === team && !object.playerId,
    );
    const number = gk ? 1 : existing.filter((object) => !object.gk).length + 2;
    addObject({
      id: uid(),
      kind: "player",
      playerId: null,
      label: gk ? (team === "home" ? "Målvakt" : "MV motst.") : team === "home" ? "Spelare" : "Motspelare",
      number,
      team,
      gk,
      x: x ?? (team === "home" ? 0.35 : 0.65),
      y: y ?? 0.5,
    });
  }

  function addBall(x = 0.5, y = 0.5) {
    if (hasBall) {
      toast.info("Det får bara finnas en boll – dra den befintliga bollen istället.");
      return;
    }
    addObject({ id: uid(), kind: "ball", label: "", team: "home", x: snapValue(x), y: snapValue(y) });
  }

  function addBankPlayer(player: BankPlayer, x = 0.4, y = 0.5) {
    addObject({
      id: uid(),
      kind: "player",
      playerId: player.id,
      label: player.name.split(" ")[0] ?? player.name,
      number: player.number,
      team: "home",
      gk: player.gk,
      photoUrl: player.photoUrl,
      x,
      y,
    });
  }

  function dropPayload(raw: string, rawX: number, rawY: number) {
    const x = snapValue(rawX);
    const y = snapValue(rawY);
    if (raw === "ball") return addBall(x, y);
    if (raw.startsWith("free:")) {
      const [, team, gk] = raw.split(":");
      return addFreePlayer(team === "away" ? "away" : "home", gk === "gk", x, y);
    }
    if (raw.startsWith("player:")) {
      const player = bank.find((item) => item.id === raw.slice(7));
      if (player) addBankPlayer(player, x, y);
    }
  }


  if (tactic.isLoading || !tactic.data) {
    return <div className="grid min-h-screen place-items-center text-muted-foreground">Laddar taktik…</div>;
  }

  const onPitchPlayerIds = new Set(
    (frame?.objects ?? []).map((object) => object.playerId).filter(Boolean) as string[],
  );
  const selectedObject = frame?.objects.find((object) => object.id === selectedId) ?? null;


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

      <div
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("text/plain")) event.preventDefault();
        }}
        onDrop={(event) => {
          const raw = event.dataTransfer.getData("text/plain");
          if (!raw) return;
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const x = Math.min(0.97, Math.max(0.03, (event.clientX - rect.left) / rect.width));
          const y = Math.min(0.97, Math.max(0.03, (event.clientY - rect.top) / rect.height));
          dropPayload(raw, x, y);
        }}
      >
        <Pitch
          pitchType={tactic.data.pitch_type}
          objects={displayedObjects}
          drawings={displayedDrawings}
          tool={tool}
          selectedId={selectedId}
          interactive={!playing}
          drawColor={tool === "zone" ? drawColor : undefined}
          hideNames={hideNames}
          gridStep={snap && !playing ? gridStep : null}
          tokenScale={prefs.playerScale}
          showPhotos={prefs.showPhotos}
          passT={passT}
          onMoveObject={moveObject}
          onMoveEnd={() => {
            dragSession.current = false;
          }}
          onObjectTrail={objectTrail}
          onSelectObject={setSelectedId}
          onAddDrawing={addDrawing}
          onRemoveDrawing={removeDrawing}
        />
      </div>


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

        {tool === "zone" && (
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ångra"
            title={historySize.undoLabel ? `Ångra: ${historySize.undoLabel}` : "Ångra"}
            onClick={undo}
            disabled={historySize.past === 0}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Gör om"
            title={historySize.redoLabel ? `Gör om: ${historySize.redoLabel}` : "Gör om"}
            onClick={redo}
            disabled={historySize.future === 0}
          >
            <Redo2 className="size-4" />
          </Button>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 text-xs font-semibold">
            <Checkbox
              checked={hideNames}
              onCheckedChange={(value) => setHideNames(value === true)}
              aria-label="Dölj namn på spelare"
            />
            {hideNames ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            Dölj namn
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 text-xs font-semibold">
            <Checkbox
              checked={snap}
              onCheckedChange={(value) => setSnap(value === true)}
              aria-label="Snäpp till rutnät"
            />
            <Grid3x3 className="size-4" />
            Rutnät
          </label>
          <Button variant="ghost" size="icon" aria-label="Spegelvänd" onClick={mirror}>
            <FlipHorizontal2 className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Lägg till boll"
            disabled={hasBall}
            onClick={() => addBall()}
          >
            <CircleDot className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Rensa plan" onClick={clearPitch}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>

      {selectedObject && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">
            {selectedObject.label || "Objekt"} markerad
          </span>
          {selectedObject.kind === "player" && (
            <>
              <Button
                size="sm"
                variant={selectedObject.gk ? "default" : "secondary"}
                onClick={() => updateObject(selectedObject.id, { gk: !selectedObject.gk })}
              >
                <Shield className="size-4" /> Målvakt
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  updateObject(selectedObject.id, {
                    team: selectedObject.team === "home" ? "away" : "home",
                  })
                }
              >
                Byt lag
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => removeObject(selectedObject.id)}>
            Ta bort
          </Button>
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card/60 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <Users className="size-4" />
          {teamId ? "Lagets trupp" : "Din spelarbank"} – dra ut på planen eller tryck för att lägga till
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {bank.map((player) => {
            const used = onPitchPlayerIds.has(player.id);
            return (
              <button
                key={player.id}
                type="button"
                draggable={!used}
                onDragStart={(event) => event.dataTransfer.setData("text/plain", `player:${player.id}`)}
                disabled={used}
                onClick={() => addBankPlayer(player)}
                className={`w-16 shrink-0 rounded-xl border border-border p-2 text-center text-xs ${
                  used ? "opacity-40" : "bg-card active:scale-95"
                }`}
              >
                <div
                  className="mx-auto grid size-11 place-items-center overflow-hidden rounded-full"
                  style={{
                    background: player.gk ? "var(--color-team-gk)" : "var(--color-team-home)",
                    color: player.gk
                      ? "var(--color-team-gk-foreground)"
                      : "var(--color-team-home-foreground)",
                  }}
                >
                  {player.photoUrl ? (
                    <img src={player.photoUrl} alt={player.name} className="size-full object-cover" />
                  ) : (
                    <span className="font-display text-base font-bold">
                      {player.number ?? (player.gk ? "MV" : "•")}
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate">{player.name}</p>
              </button>
            );
          })}

          <BankChip payload="free:home" label="Anonym" onAdd={() => addFreePlayer("home", false)}>
            <span
              className="grid size-11 place-items-center rounded-full"
              style={{
                background: "var(--color-team-home)",
                color: "var(--color-team-home-foreground)",
              }}
            >
              <UserPlus className="size-5" />
            </span>
          </BankChip>
          <BankChip payload="free:home:gk" label="Målvakt" onAdd={() => addFreePlayer("home", true)}>
            <span
              className="grid size-11 place-items-center rounded-full"
              style={{ background: "var(--color-team-gk)", color: "var(--color-team-gk-foreground)" }}
            >
              <Shield className="size-5" />
            </span>
          </BankChip>
          <BankChip payload="free:away" label="Motst." onAdd={() => addFreePlayer("away", false)}>
            <span
              className="grid size-11 place-items-center rounded-full"
              style={{
                background: "var(--color-team-away)",
                color: "var(--color-team-away-foreground)",
              }}
            >
              <UserPlus className="size-5" />
            </span>
          </BankChip>
          <BankChip payload="free:away:gk" label="Motst. MV" onAdd={() => addFreePlayer("away", true)}>
            <span
              className="grid size-11 place-items-center rounded-full"
              style={{ background: "var(--color-team-gk)", color: "var(--color-team-gk-foreground)" }}
            >
              <Shield className="size-5" />
            </span>
          </BankChip>
          <BankChip payload="ball" label="Boll" onAdd={() => addBall()} disabled={hasBall}>
            <span className="grid size-11 place-items-center rounded-full bg-white text-[#141414]">
              <CircleDot className="size-6" />
            </span>
          </BankChip>
        </div>

        {bank.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {teamId ? (
              "Inga spelare i truppen än – lägg till dem under fliken Truppen."
            ) : (
              <>
                Inga sparade spelare än.{" "}
                <Link to="/bank" className="underline">
                  Fyll på banken
                </Link>
                .
              </>
            )}
          </p>
        )}
      </section>



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
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              tactic.data && downloadTacticFile(tactic.data.name, tactic.data.pitch_type, frames)
            }
          >
            <Download className="size-4" /> Fil
          </Button>
          <ExportDialog
            frameCount={frames.length}
            stepMs={STEP_MS / speed}
            busy={exporting !== null}
            onExport={(settings) => runExport(settings)}
          />
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
  children: ReactNode;
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

function BankChip({
  payload,
  label,
  onAdd,
  disabled = false,
  children,
}: {
  payload: string;
  label: string;
  onAdd: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      disabled={disabled}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", payload)}
      onClick={onAdd}
      className="w-16 shrink-0 rounded-xl border border-border bg-card p-2 text-center text-xs active:scale-95 disabled:opacity-40"
    >
      <span className="mx-auto flex justify-center">{children}</span>
      <p className="mt-1 truncate">{label}</p>
    </button>
  );
}
