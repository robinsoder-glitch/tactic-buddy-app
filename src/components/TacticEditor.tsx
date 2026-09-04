import { loadPrefs, subscribePrefs, type AppPrefs } from "@/lib/prefs";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CircleDot,
  Grid3x3,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FlipHorizontal2,
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
import {
  fetchPlayers,
  fetchTactic,
  publishTactic,
  renameTactic,
  saveFrames,
  setTacticPitchType,
  setTacticSharing,
} from "@/lib/db";
import { fetchTeamPlayers } from "@/lib/teams";
import { exportGif, exportVideo, QUALITY_PRESETS } from "@/lib/export-clip";
import { exportPdf, previewPdfUrl } from "@/lib/export-pdf";
import { useAccount } from "@/hooks/useAccount";
import { ExportDialog } from "@/components/ExportDialog";
import type { ExportSettings } from "@/components/ExportDialog";
import { downloadTacticFile } from "@/lib/tactic-file";
import { displayDrawingsAt, interpolateFrames, normalizeTransitionPaths, uid } from "@/lib/tactics";
import { appendSequence, insertSequenceAfter } from "@/lib/sequences";
import {
  entry as historyEntry,
  loadHistory,
  saveHistory,
  type HistoryEntry,
} from "@/lib/tactic-history";
import type { Drawing, FieldObject, Frame, PitchType } from "@/lib/tactics";
import { PITCH_SIZES } from "@/lib/tactics";
import {
  buildLineup,
  formationsForPitch,
  pitchForFormation,
  type Formation,
} from "@/lib/formations";
import { TacticThumb } from "@/components/TacticThumb";
import { Pitch, SoccerBall, type Tool } from "@/components/Pitch";
import { useConfirm } from "@/components/ConfirmDelete";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CoachTour, type TourStep } from "@/components/CoachTour";

const TOUR_KEY = "taktiktavla:tour:v1";

const TOUR_STEPS: TourStep[] = [
  {
    target: "player",
    title: "1. Sätt ut dina spelare",
    body: "Tryck på Egen spelare och peka sedan på planen – en gång per spelare. Sätt ut så många spelare som situationen behöver och tryck Klar.",
  },
  {
    target: "opponent",
    title: "2. Lägg till motståndare",
    body: "Tryck på Motståndare och peka på planen där de ska stå. Lägg ut lika många som du vill visa.",
  },
  {
    target: "ball",
    title: "3. Lägg till bollen",
    body: "Tryck på Boll så hamnar den på planen. Dra den dit spelet börjar.",
  },
  {
    target: "sequence",
    title: "4. Ny sekvens = rörelse",
    body: "Tryck Ny sekvens och dra sedan spelare och boll dit de ska. Löplinjer och passningar ritas automatiskt. Vill du ha fler rörelser trycker du Ny sekvens igen.",
  },
  {
    target: "play",
    title: "5. Spela upp",
    body: "När du är klar trycker du Spela allt så animeras hela taktiken från startläget.",
  },
  {
    target: "save",
    title: "6. Spara med eget namn",
    body: "Tryck Spara, skriv ett namn du känner igen taktiken på och spara. Allt sparas också automatiskt medan du jobbar.",
  },
];

const STEP_MS = 1400;
const GRID_FALLBACK = 0.05;
const FINE_STEP = 0.01;
const MARK_COLORS = [
  "oklch(0.75 0.19 55)",
  "oklch(0.72 0.2 25)",
  "oklch(0.8 0.16 200)",
  "oklch(0.95 0 0)",
];

export type EditorMode = "simple" | "advanced";
const MODE_KEY = "taktiktavla:mode";

function loadMode(): EditorMode {
  if (typeof window === "undefined") return "simple";
  return window.localStorage.getItem(MODE_KEY) === "advanced" ? "advanced" : "simple";
}

/** Startläge är uppställningen, sekvenserna beskriver rörelserna efter den. */
export function frameLabel(index: number) {
  return index === 0 ? "Startläge" : `Sekvens ${index}`;
}

/** Gamla automatiska namn ("Steg N") ska inte längre visas som egna namn. */
function isAutoName(name: string | null | undefined) {
  return !name || /^Steg \d+$/.test(name) || /^Sekvens \d+$/.test(name) || name === "Startläge";
}

function historyMeta(past: HistoryEntry[], future: HistoryEntry[]) {
  return {
    past: past.length,
    future: future.length,
    undoLabel: past[past.length - 1]?.label ?? "",
    redoLabel: future[0]?.label ?? "",
  };
}

/** Enkel tidsvisning på svenska, t.ex. "3,2 s" eller "1 min 05 s". */
function secondsLabel(seconds: number) {
  const safe = Math.max(0, seconds);
  if (safe < 60) return `${safe.toFixed(1).replace(".", ",")} s`;
  const mins = Math.floor(safe / 60);
  const rest = Math.round(safe - mins * 60);
  return `${mins} min ${String(rest).padStart(2, "0")} s`;
}

type BankPlayer = {
  id: string;
  name: string;
  number: number | null;
  photoUrl: string | null;
  gk: boolean;
};

export function TacticEditor({ id }: { id: string }) {
  const { confirm, confirmDialog } = useConfirm();
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
  const { memberships } = useAccount();
  const teamName = memberships.find((item) => item.team_id === teamId)?.team?.name ?? null;

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
  const [mode, setMode] = useState<EditorMode>(loadMode);
  const advanced = mode === "advanced";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(() => loadPrefs().speed);
  const [loop, setLoop] = useState(() => loadPrefs().loop);
  const [prefs, setPrefs] = useState<AppPrefs>(() => loadPrefs());
  const gridStep = prefs.gridStep || GRID_FALLBACK;
  const [progress, setProgress] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [hideNames, setHideNames] = useState(() => loadPrefs().hideNames);
  const [snap, setSnap] = useState(prefs.grid);
  const [drawColor, setDrawColor] = useState(MARK_COLORS[0]!);

  const pastRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const [historySize, setHistorySize] = useState({
    past: 0,
    future: 0,
    undoLabel: "",
    redoLabel: "",
  });

  const [placeMode, setPlaceMode] = useState<null | "home" | "away">(null);
  const [movementTip, setMovementTip] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [playUntil, setPlayUntil] = useState<number | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [exporting, setExporting] = useState<null | "gif" | "video" | "pdf">(null);
  const framesRef = useRef<Frame[]>([]);
  const dragSession = useRef(false);
  framesRef.current = frames;

  useEffect(() => {
    if (tactic.data) {
      setFrames(
        // Äldre taktiker sparade vägen i källsekvensen – normaliseras till målsekvensen vid läsning.
        normalizeTransitionPaths(tactic.data.frames).map((item) => {
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

  const isDraft = Boolean(tactic.data?.is_draft);

  const changePitch = useMutation({
    mutationFn: (pitchType: PitchType) => setTacticPitchType(id, pitchType),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tactic", id] });
      void queryClient.invalidateQueries({ queryKey: ["tactics"] });
    },
    onError: () => toast.error("Det gick inte att byta plantyp."),
  });

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

  /** Spara med eget namn – namnet ändras bara om användaren skrivit något nytt. */
  const saveWithName = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Inte inloggad");
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Ge taktiken ett namn först.");
      const hasContent = frames.some((item) => item.objects.length > 0 || item.drawings.length > 0);
      if (!hasContent) throw new Error("Lägg ut minst en spelare eller boll innan du sparar.");
      await saveFrames(id, user.id, frames);
      if (isDraft) {
        await publishTactic(id, trimmed);
      } else if (trimmed !== tactic.data?.name) {
        await renameTactic(id, trimmed);
      }
    },
    onSuccess: () => {
      setDirty(false);
      setSaveOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["tactic", id] });
      void queryClient.invalidateQueries({ queryKey: ["tactics"] });
      void queryClient.invalidateQueries({ queryKey: ["tactic", id] });
      toast.success("Taktiken är sparad i Mina taktiker.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Kunde inte spara taktiken."),
  });

  const saveRef = useRef(save);
  saveRef.current = save;

  // Visa guiden första gången tavlan öppnas
  useEffect(() => {
    if (!tactic.data) return;
    try {
      if (window.localStorage.getItem(TOUR_KEY)) return;
      window.localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* ignorera blockerad lagring */
    }
    setTourOpen(true);
  }, [tactic.data]);

  // Autosave with debounce
  useEffect(() => {
    if (!dirty) return;
    const timeout = setTimeout(() => saveRef.current.mutate(), 2000);
    return () => clearTimeout(timeout);
  }, [dirty, frames]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (presenting) setPresenting(false);
      else if (placeMode) setPlaceMode(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, placeMode]);

  /** Helskärm när tavlan visas för laget – särskilt viktigt på mobil. */
  useEffect(() => {
    if (typeof document === "undefined") return;
    const element = document.documentElement;
    if (presenting) {
      void element.requestFullscreen?.().catch(() => undefined);
    } else if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => undefined);
    }
  }, [presenting]);

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
    const limit = playUntil ?? frames.length - 1;
    const total = ((limit - from) * STEP_MS) / speed;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      const value = from + (elapsed / STEP_MS) * speed;
      if (value >= limit) {
        if (loop && playUntil == null) {
          setProgress(0);
          setPlaying(false);
          setTimeout(() => setPlaying(true), 60);
        } else {
          setProgress(limit);
          setCurrent(Math.round(limit));
          setPlaying(false);
          setPlayUntil(null);
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
  }, [playing, speed, loop, frames.length, playUntil]);

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
  // Vägarna hör till målsekvensen: under övergången visas den sekvens vi är på väg mot.
  // Pilar lagras aldrig – de härleds alltid ur föregående och aktuell bild.
  const displayedDrawings = useMemo(
    () => displayDrawingsAt(frames, progress, animating, current),
    [frames, progress, animating, current],
  );
  const passT = animating && frames.length > 1 ? Math.min(Math.max(segmentT, 0), 1) : null;

  function addObject(object: FieldObject) {
    commit(
      (prev) => prev.map((item) => ({ ...item, objects: [...item.objects, object] })),
      "Lade till objekt",
    );
  }

  /** Ersätter eget lags spelare med vald formation i alla steg. Varje truppspelare används en gång. */
  function applyFormation(formation: Formation) {
    if (frames.length > 1) {
      const ok = window.confirm("Byta formation? Nuvarande placeringar och sekvenser ersätts.");
      if (!ok) return;
    }

    const lineup: FieldObject[] = buildLineup(formation.slots, bank).map((entry) => ({
      id: uid(),
      kind: "player",
      playerId: entry.playerId,
      label: entry.label,
      number: entry.number,
      team: "home",
      gk: entry.gk,
      photoUrl: entry.photoUrl,
      x: entry.x,
      y: entry.y,
    }));

    // Bollen läggs strax framför den främsta spelaren – aldrig exakt under en spelare.
    const front = lineup.reduce((best, item) => (item.x > best.x ? item : best), lineup[0]!);
    const ballPos = { x: Math.min(0.95, front.x + 0.05), y: Math.min(0.95, front.y + 0.05) };

    const pitchTarget = pitchForFormation(formation.players);
    if (pitchTarget !== tactic.data?.pitch_type) changePitch.mutate(pitchTarget);

    commit(
      (prev) =>
        prev.map((item) => ({
          ...item,
          // Formationsbyte nollställer även gamla markeringar så inga inaktuella linjer blir kvar.
          drawings: [],
          objects: [
            ...item.objects
              .filter((object) => !(object.kind === "player" && object.team === "home"))
              .map((object) => (object.kind === "ball" ? { ...object, ...ballPos } : object)),
            ...lineup.map((object) => ({ ...object })),
          ],
        })),
      `Formation ${formation.label}`,
    );
    toast.success(`Formation ${formation.label} placerad.`);
  }

  function removeObject(objectId: string) {
    commit(
      (prev) =>
        prev.map((item) => ({
          ...item,
          objects: item.objects.filter((o) => o.id !== objectId),
          // Vägar/markeringar som hör till objektet försvinner samtidigt.
          drawings: item.drawings.filter((d) => d.objectId !== objectId),
        })),
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

  // Dragningen flyttar objektet i den aktiva bilden. Pilar sparas inte längre –
  // de härleds ur föregående och aktuell bild vid rendering.
  function objectTrail(objectId: string, _type: "run" | "pass", from: { x: number; y: number }) {
    const currentFrame = framesRef.current[current];
    const object = currentFrame?.objects.find((item) => item.id === objectId);
    if (!object) return;
    const moved = Math.hypot(object.x - from.x, object.y - from.y);
    if (moved < 0.015) return;
    setMovementTip(false);
    setDirty(true);
    if (current === 0) return;
    toast.success(`${object.label || "Objektet"} rör sig i ${frameLabel(current)}`, {
      action: { label: "Ångra", onClick: () => undoRef.current() },
    });
  }

  function addDrawing(drawing: Omit<Drawing, "id">) {
    commit(
      (prev) =>
        prev.map((item, index) =>
          index === current
            ? { ...item, drawings: [...item.drawings, { ...drawing, id: uid() }] }
            : item,
        ),
      "Ritade markering",
    );
  }

  function removeDrawing(drawingId: string) {
    commit(
      (prev) =>
        prev.map((item, index) =>
          index === current
            ? { ...item, drawings: item.drawings.filter((d) => d.id !== drawingId) }
            : item,
        ),
      "Tog bort markering",
    );
  }

  /** Ny sekvens läggs alltid sist, oavsett vilket kort som är markerat. */
  function addFrame() {
    const target = framesRef.current.length;
    commit((prev) => renumber(appendSequence(prev)), "Ny sekvens");
    setCurrent(target);
    setProgress(target);
  }

  /** Avancerat: infoga en sekvens direkt efter den aktiva. */
  function insertFrameAfterCurrent() {
    commit((prev) => renumber(insertSequenceAfter(prev, current)), "Infogade sekvens");
    setCurrent(current + 1);
    setProgress(current + 1);
  }

  // Auto-generated names are derived from the position (Startläge / Sekvens N); custom names stay.
  function renumber(list: Frame[]) {
    return list.map((item) => (isAutoName(item.name) ? { ...item, name: null } : item));
  }

  async function deleteFrame(index: number) {
    if (frames.length <= 1) return;
    if (prefs.confirmDelete) {
      const ok = await confirm({
        title: `Radera ${frameLabel(index).toLowerCase()}`,
        description: `${frameLabel(index)} tas bort med alla positioner, pilar och anteckningar i det steget.`,
      });
      if (!ok) return;
    }
    commit((prev) => renumber(prev.filter((_, i) => i !== index)), "Tog bort sekvens");
    setCurrent((value) => Math.max(0, Math.min(value, frames.length - 2)));
    setProgress((value) => Math.max(0, Math.min(value, frames.length - 2)));
  }

  const stepSeconds = STEP_MS / 1000 / speed;
  const totalSeconds = Math.max(frames.length - 1, 0) * stepSeconds;
  const currentSeconds = progress * stepSeconds;

  const seekTo = useCallback(
    (value: number) => {
      const max = Math.max(frames.length - 1, 0);
      const clamped = Math.min(max, Math.max(0, value));
      setPlaying(false);
      setProgress(clamped);
      setCurrent(Math.round(clamped));
    },
    [frames.length],
  );

  const seekSeconds = useCallback(
    (seconds: number) => seekTo(seconds / stepSeconds),
    [seekTo, stepSeconds],
  );

  const seekRef = useRef<(sign: number, whole: boolean) => void>(() => {});
  seekRef.current = (sign, whole) => {
    if (!Number.isFinite(sign)) {
      seekTo(sign < 0 ? 0 : frames.length - 1);
      return;
    }
    if (whole) {
      seekTo(Math.round(progress) + sign);
      return;
    }
    seekTo(progress + (sign * 0.1) / stepSeconds);
  };

  function goToStep(index: number) {
    const next = Math.max(0, Math.min(index, frames.length - 1));
    setPlaying(false);
    setCurrent(next);
    setProgress(next);
  }

  const undoRef = useRef<() => void>(() => {});

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
  undoRef.current = undo;

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
  }, [nudge, selectedId, gridStep]);

  // Ändrade inställningar (t.ex. rutnätets storlek) slår igenom direkt.
  useEffect(() => subscribePrefs(setPrefs), []);

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
    setFrames((prev) =>
      prev.map((item, index) => (index === current ? { ...item, note: value } : item)),
    );
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

  function pdfOptions(settings: ExportSettings) {
    return {
      frames,
      pitchType: tactic.data?.pitch_type ?? "small",
      title: tactic.data?.name ?? "Taktik",
      teamName,
      cover: settings.cover,
      paper: settings.paper,
      orientation: settings.orientation,
      margin: settings.margin,
      scale: settings.scale,
      hideNames,
      tokenScale: prefs.playerScale,
      showPhotos: prefs.showPhotos,
      width: Math.max(QUALITY_PRESETS[settings.quality].width, 900),
    };
  }

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
      if (kind === "pdf") {
        await exportPdf(pdfOptions(settings), filename);
        toast.success("PDF nedladdad");
      } else if (kind === "gif") {
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

  /** Speglar hela taktiken: startläge och samtliga sekvenser. */
  function mirror() {
    commit((prev) =>
      prev.map((item) => ({
        ...item,
        objects: item.objects.map((object) => ({ ...object, x: 1 - object.x })),
        drawings: item.drawings.map((drawing) => ({
          ...drawing,
          x1: 1 - drawing.x1,
          x2: 1 - drawing.x2,
        })),
      })),
    );
    toast.success("Hela taktiken spegelvändes.");
  }

  function clearPitch() {
    commit((prev) => prev.map((item) => ({ ...item, objects: [], drawings: [] })));
    setSelectedId(null);
  }

  /** Förskjuter nya objekt så att de aldrig hamnar ovanpå varandra. */
  function freeSpot(x: number, y: number): { x: number; y: number } {
    const taken = frame?.objects ?? [];
    const min = 0.055;
    let cx = x;
    let cy = y;
    for (let step = 0; step < 40; step += 1) {
      const clash = taken.some((object) => Math.hypot(object.x - cx, object.y - cy) < min);
      if (!clash) break;
      const angle = step * 0.9;
      const radius = min + Math.floor(step / 8) * min;
      cx = Math.min(0.95, Math.max(0.05, x + Math.cos(angle) * radius));
      cy = Math.min(0.95, Math.max(0.05, y + Math.sin(angle) * radius));
    }
    return { x: cx, y: cy };
  }

  function addFreePlayer(team: "home" | "away", wantGk: boolean, x?: number, y?: number) {
    // Endast det egna laget har målvakt på tavlan.
    const gk = team === "home" && wantGk;
    const existing = (frame?.objects ?? []).filter(
      (object) => object.kind === "player" && object.team === team && !object.playerId,
    );
    const number = gk ? 1 : existing.filter((object) => !object.gk).length + 2;
    const spot = freeSpot(x ?? (team === "home" ? 0.35 : 0.65), y ?? 0.5);
    addObject({
      id: uid(),
      kind: "player",
      playerId: null,
      label: gk ? "Målvakt" : team === "home" ? "Spelare" : "Motspelare",
      number,
      team,
      gk,
      x: spot.x,
      y: spot.y,
    });
  }

  /** Bara en målvakt får finnas – den nya ersätter den gamla. */
  function toggleGoalkeeper(objectId: string, gk: boolean) {
    if (!gk) {
      updateObject(objectId, { gk: false });
      return;
    }
    for (const object of frame?.objects ?? []) {
      if (object.kind === "player" && object.gk && object.id !== objectId) {
        updateObject(object.id, { gk: false });
      }
    }
    updateObject(objectId, { gk: true });
  }

  function addBall(x = 0.5, y = 0.5) {
    if (hasBall) {
      toast.info("Det får bara finnas en boll – dra den befintliga bollen istället.");
      return;
    }
    addObject({
      id: uid(),
      kind: "ball",
      label: "",
      team: "home",
      x: snapValue(x),
      y: snapValue(y),
    });
  }

  function addMaterial(kind: "cone" | "goal", x = 0.5, y = 0.5) {
    const spot = freeSpot(x, y);
    addObject({
      id: uid(),
      kind,
      label: "",
      team: "home",
      x: snapValue(spot.x),
      y: snapValue(spot.y),
    });
  }

  function addBankPlayer(player: BankPlayer, x = 0.4, y = 0.5) {
    const spot = freeSpot(x, y);
    addObject({
      id: uid(),
      kind: "player",
      playerId: player.id,
      label: player.name.split(" ")[0] ?? player.name,
      number: player.number,
      team: "home",
      gk: player.gk,
      photoUrl: player.photoUrl,
      x: spot.x,
      y: spot.y,
    });
  }

  /** Placeringsläge: varje tryck på planen lägger ut nästa spelare. */
  function placeAt(x: number, y: number) {
    if (!placeMode) return;
    addFreePlayer(placeMode, false, snapValue(x), snapValue(y));
    toast.success(placeMode === "home" ? "Spelare tillagd." : "Motståndare tillagd.");
  }

  function startFirstMovement() {
    addFrame();
    setTool("select");
    setMovementTip(true);
    toast.success("Sekvens 1 skapad.");
  }

  function playStep() {
    if (current < 1) return;
    setProgress(current - 1);
    setPlayUntil(current);
    setPlaying(true);
  }

  function playAll() {
    if (frames.length < 2) return;
    setProgress(0);
    setCurrent(0);
    setPlayUntil(null);
    setPlaying(true);
  }

  function dropPayload(raw: string, rawX: number, rawY: number) {
    const x = snapValue(rawX);
    const y = snapValue(rawY);
    if (raw === "ball") return addBall(x, y);
    if (raw === "cone") return addMaterial("cone", x, y);
    if (raw === "goal") return addMaterial("goal", x, y);
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
    return (
      <div className="grid min-h-dvh place-items-center text-muted-foreground">Laddar taktik…</div>
    );
  }

  const onPitchPlayerIds = new Set(
    (frame?.objects ?? []).map((object) => object.playerId).filter(Boolean) as string[],
  );
  const selectedObject = frame?.objects.find((object) => object.id === selectedId) ?? null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-4xl flex-col gap-3 px-3 pb-6 pt-3">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" aria-label="Tillbaka">
          <Link to="/">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-bold">
          {isDraft ? "Ny taktik" : tactic.data.name}
        </h1>
        <span className="text-xs text-muted-foreground">
          {save.isPending ? "Sparar…" : isDraft ? "Inte sparad än" : dirty ? "Osparat" : "Sparat"}
        </span>
        <Button
          variant="secondary"
          size="sm"
          aria-pressed={advanced}
          onClick={() => {
            const next: EditorMode = advanced ? "simple" : "advanced";
            setMode(next);
            if (next === "simple" && tool === "zone") setTool("select");
            try {
              window.localStorage.setItem(MODE_KEY, next);
            } catch {
              /* ignorera blockerad lagring */
            }
          }}
        >
          {advanced ? "Byt till Enkel" : "Byt till Avancerad"}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Visa guide"
          onClick={() => setTourOpen(true)}
        >
          <HelpCircle className="size-5" />
        </Button>

        <Button
          size="sm"
          data-tour="save"
          onClick={() => {
            setNameDraft(isDraft ? "" : (tactic.data?.name ?? ""));
            setSaveOpen(true);
          }}
        >
          <Save className="size-4" /> Spara
        </Button>
      </header>

      {advanced && (
        <div
          className="mb-2 flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Planlayout"
        >
          <span className="text-xs font-semibold text-muted-foreground">Plan:</span>
          {(Object.keys(PITCH_SIZES) as PitchType[]).map((key) => (
            <Button
              key={key}
              size="sm"
              variant={tactic.data!.pitch_type === key ? "default" : "secondary"}
              aria-pressed={tactic.data!.pitch_type === key}
              disabled={changePitch.isPending}
              onClick={() => changePitch.mutate(key)}
            >
              {PITCH_SIZES[key].label}
            </Button>
          ))}
        </div>
      )}

      {advanced && (
        <div className="mb-2 flex flex-wrap items-center gap-2" role="group" aria-label="Formation">
          <span className="text-xs font-semibold text-muted-foreground">Formation:</span>
          {formationsForPitch(tactic.data.pitch_type).map((formation) => (
            <Button
              key={formation.id}
              size="sm"
              variant="secondary"
              onClick={() => applyFormation(formation)}
            >
              {formation.label}
            </Button>
          ))}
        </div>
      )}

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
          {...(placeMode ? { onPlaceAt: placeAt } : {})}
          onSelectObject={setSelectedId}
          onAddDrawing={addDrawing}
          onRemoveDrawing={removeDrawing}
        />
      </div>

      {placeMode ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary bg-primary/10 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            Tryck på planen för att lägga ut {placeMode === "home" ? "spelare" : "motståndare"}.
          </span>
          <Button size="sm" onClick={() => setPlaceMode(null)}>
            Klar
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
          {(frame?.objects.length ?? 0) === 0 && current === 0 && (
            <span className="w-full text-xs text-muted-foreground">
              Börja här – lägg ut spelarna och bollen där situationen börjar.
            </span>
          )}
          <Button
            size="sm"
            variant="secondary"
            data-tour="player"
            onClick={() => setPlaceMode("home")}
          >
            <UserPlus className="size-4" /> Egen spelare
          </Button>
          <Button
            size="sm"
            variant="secondary"
            data-tour="opponent"
            onClick={() => setPlaceMode("away")}
          >
            <UserPlus className="size-4" /> Motståndare
          </Button>
          <Button
            size="sm"
            variant="secondary"
            data-tour="ball"
            onClick={() => {
              if (hasBall) {
                toast.info("Bollen finns redan – dra den på planen för att flytta den.");
                return;
              }
              addBall();
            }}
          >
            <CircleDot className="size-4" /> Boll
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-2" data-tour="play">
            {frames.length === 1 ? (
              <Button
                size="sm"
                disabled={(frame?.objects.length ?? 0) === 0}
                onClick={startFirstMovement}
              >
                <Plus className="size-4" /> Skapa första rörelsen
              </Button>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={playStep} disabled={current < 1}>
                  <Play className="size-4" /> Spela detta steg
                </Button>
                <Button size="sm" onClick={playAll}>
                  <Play className="size-4" /> Spela allt
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setPresenting(true)}>
                  Visa för laget
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {movementTip && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            Flytta nu de spelare eller den boll som ska röra sig. Resten står kvar automatiskt.
          </span>
          <Button size="sm" variant="ghost" onClick={() => setMovementTip(false)}>
            Stäng
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {advanced && (
          <ToolButton
            active={tool === "zone"}
            onClick={() => setTool(tool === "zone" ? "select" : "zone")}
            label="Zon"
          >
            <Square className="size-4" />
            <span className="text-xs font-semibold">Zon</span>
          </ToolButton>
        )}

        {advanced && tool === "zone" && (
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
          {advanced && (
            <>
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
              <Button
                variant="ghost"
                size="sm"
                aria-label="Spegelvänd hela taktiken"
                onClick={mirror}
              >
                <FlipHorizontal2 className="size-4" /> Spegelvänd allt
              </Button>
            </>
          )}

          <Button variant="ghost" size="sm" aria-label="Rensa planen" onClick={clearPitch}>
            <Trash2 className="size-4 text-destructive" /> Rensa
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
                onClick={() => toggleGoalkeeper(selectedObject.id, !selectedObject.gk)}
              >
                <Shield className="size-4" />{" "}
                {selectedObject.gk ? "Är målvakt" : "Gör till målvakt"}
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
                {selectedObject.team === "home" ? "Gör till motståndare" : "Gör till eget lag"}
              </Button>
            </>
          )}
          <Button size="sm" variant="ghost" onClick={() => removeObject(selectedObject.id)}>
            Ta bort
          </Button>
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card/60 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs tracking-wide text-muted-foreground">
          <Users className="size-4" />
          {teamId ? "Lagets trupp" : "Din spelarbank"} – dra ut på planen eller tryck för att lägga
          till
        </div>

        <div className="flex gap-3 overflow-x-auto pb-1">
          {bank.map((player) => {
            const used = onPitchPlayerIds.has(player.id);
            return (
              <button
                key={player.id}
                type="button"
                draggable={!used}
                onDragStart={(event) =>
                  event.dataTransfer.setData("text/plain", `player:${player.id}`)
                }
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
                    <img
                      src={player.photoUrl}
                      alt={player.name}
                      className="size-full object-cover"
                    />
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
          <BankChip
            payload="free:home:gk"
            label="Målvakt"
            onAdd={() => addFreePlayer("home", true)}
          >
            <span
              className="grid size-11 place-items-center rounded-full"
              style={{
                background: "var(--color-team-gk)",
                color: "var(--color-team-gk-foreground)",
              }}
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
          <BankChip payload="ball" label="Boll" onAdd={() => addBall()} disabled={hasBall}>
            <span className="grid size-11 place-items-center rounded-full bg-transparent">
              <svg viewBox="-14 -14 28 28" className="size-9" aria-hidden="true">
                <SoccerBall r={12} strokeWidth={0.9} />
              </svg>
            </span>
          </BankChip>
          {advanced && (
            <>
              <BankChip payload="cone" label="Kon" onAdd={() => addMaterial("cone")}>
                <span
                  className="grid size-11 place-items-center rounded-full text-lg"
                  style={{ background: "oklch(0.75 0.19 55)", color: "#20140a" }}
                >
                  ▲
                </span>
              </BankChip>
              <BankChip payload="goal" label="Minimål" onAdd={() => addMaterial("goal")}>
                <span className="grid size-11 place-items-center rounded-full border-2 border-foreground/60 text-xs font-bold">
                  MÅL
                </span>
              </BankChip>
            </>
          )}
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

      {advanced && (
        <section className="rounded-xl border border-border bg-card p-3">
          <label
            className="text-xs font-semibold tracking-wide text-muted-foreground"
            htmlFor="step-note"
          >
            Anteckning för {frame?.name || frameLabel(current)}
          </label>
          <Textarea
            id="step-note"
            rows={2}
            value={frame?.note ?? ""}
            onChange={(event) => setNote(event.target.value)}
            placeholder="T.ex. Ytterbacken går på överlapp när sexan vänder spelet."
            className="mt-2"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Visas under uppspelning och i delade länkar.
          </p>
        </section>
      )}

      {advanced && (
        <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Button
            variant={isPublic ? "default" : "secondary"}
            size="sm"
            onClick={() => {
              if (isPublic) {
                share.mutate(false);
                return;
              }
              void confirm({
                tone: "default",
                title: "Dela taktiken via länk?",
                description:
                  "Alla som har länken kan se taktiken – även personer utan konto. Spelarnas namn, foton och lag byts ut mot Spelare 1, Spelare 2 och så vidare. Obs: dina anteckningar i bilderna visas som de är, så skriv inget känsligt där. Du kan stänga av delningen när du vill.",
                confirmLabel: "Slå på delning",
              }).then((ok) => ok && share.mutate(true));
            }}
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
              onPreviewPdf={(settings) => previewPdfUrl(pdfOptions(settings))}
            />
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Föregående sekvens"
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
            aria-label="Nästa sekvens"
            onClick={() => goToStep(current + 1)}
            disabled={current >= frames.length - 1}
          >
            <ChevronRight className="size-4" />
          </Button>
          <button
            type="button"
            aria-label="Hastighet"
            onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 0.5 : 1)}
            className="rounded-md border border-border px-2 py-1 text-xs font-semibold"
          >
            {speed === 0.5 ? "Långsam" : speed === 2 ? "Snabb" : "Normal"}
          </button>
          <Button
            variant={loop ? "default" : "ghost"}
            size="icon"
            aria-label="Loopa"
            onClick={() => setLoop((value) => !value)}
          >
            <Repeat className="size-4" />
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Startläge + {Math.max(frames.length - 1, 0)} sekvenser
          </span>
        </div>

        <div className="relative mt-3">
          <input
            type="range"
            aria-label="Tidslinje"
            min={0}
            max={Math.max(frames.length - 1, 0)}
            step={0.01}
            value={progress}
            disabled={frames.length < 2}
            onChange={(event) => seekTo(Number(event.target.value))}
            className="w-full accent-[var(--color-primary)]"
          />
          <div className="pointer-events-none mt-1 flex justify-between px-1">
            {frames.map((item, index) => (
              <span
                key={item.id}
                className={`h-1.5 w-1.5 rounded-full ${
                  Math.round(progress) === index ? "bg-primary" : "bg-muted-foreground/40"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums text-foreground">
            {secondsLabel(currentSeconds)} av {secondsLabel(totalSeconds)}
          </span>
          {advanced && (
            <label className="ml-auto flex items-center gap-1">
              <span>Sök till</span>
              <input
                type="number"
                aria-label="Hoppa till tid (sekunder)"
                min={0}
                max={Number(totalSeconds.toFixed(1))}
                step={0.1}
                value={Number(currentSeconds.toFixed(1))}
                disabled={frames.length < 2}
                onChange={(event) => seekSeconds(Number(event.target.value))}
                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-right font-mono text-foreground"
              />
              <span>s</span>
            </label>
          )}
        </div>
        {advanced && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Piltangenter ← → spolar 0,1 s (Skift = hel sekvens), Home/End hoppar till start/slut.
          </p>
        )}

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {frames.map((item, index) => (
            <div
              key={item.id}
              className={`flex w-32 shrink-0 flex-col gap-1 rounded-lg border p-2 text-sm ${
                index === current ? "border-primary bg-primary/15" : "border-border"
              }`}
            >
              <button
                type="button"
                className="overflow-hidden rounded-md border border-border/60"
                aria-label={`Visa ${item.name || frameLabel(index)}`}
                onClick={() => goToStep(index)}
              >
                <TacticThumb pitchType={tactic.data.pitch_type} frame={item} width={220} />
              </button>
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  className="truncate text-left text-xs font-semibold"
                  onClick={() => goToStep(index)}
                  onDoubleClick={() => {
                    const value = window.prompt("Namn på sekvensen", item.name ?? "");
                    if (value !== null) {
                      commit((prev) =>
                        prev.map((f, i) => (i === index ? { ...f, name: value } : f)),
                      );
                    }
                  }}
                >
                  {item.name || frameLabel(index)}
                </button>
                {index > 0 &&
                  JSON.stringify(frames[index - 1]?.objects) === JSON.stringify(item.objects) && (
                    <span className="rounded bg-muted px-1 text-[10px] text-muted-foreground">
                      Inga förändringar
                    </span>
                  )}
                {frames.length > 1 && (
                  <button
                    type="button"
                    aria-label="Ta bort sekvens"
                    onClick={() => void deleteFrame(index)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            data-tour="sequence"
            onClick={addFrame}
          >
            <Plus className="size-4" /> Ny sekvens
          </Button>
          {advanced && frames.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={insertFrameAfterCurrent}
              title="Infoga sekvens efter denna"
            >
              <Plus className="size-4" /> Infoga sekvens efter denna
            </Button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Placera spelarna i Startläge. Varje ny sekvens utgår från föregående slutläge – flytta
          bara det som ska röra sig. Dubbeltryck på en sekvens för att döpa om den.
        </p>
      </section>
      {presenting && (
        <div className="fixed inset-0 z-50 flex flex-col gap-3 bg-background p-4">
          <div className="flex items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate font-display text-lg font-bold">
              {frames[current]?.name || frameLabel(current)}
            </h2>
            <Button size="sm" variant="secondary" onClick={() => setPresenting(false)}>
              Stäng
            </Button>
          </div>
          <div className="mx-auto w-full max-w-5xl flex-1">
            <Pitch
              pitchType={tactic.data.pitch_type}
              objects={displayedObjects}
              drawings={displayedDrawings}
              interactive={false}
              hideNames={hideNames}
              tokenScale={prefs.playerScale}
              showPhotos={prefs.showPhotos}
              passT={passT}
            />
            {frames[current]?.note && (
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {frames[current]?.note}
              </p>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="secondary"
              size="icon"
              aria-label="Föregående sekvens"
              onClick={() => goToStep(current - 1)}
              disabled={current === 0}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              size="icon"
              aria-label={playing ? "Pausa" : "Spela allt"}
              onClick={() => (playing ? setPlaying(false) : playAll())}
              disabled={frames.length < 2}
            >
              {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Nästa sekvens"
              onClick={() => goToStep(current + 1)}
              disabled={current >= frames.length - 1}
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
        </div>
      )}
      {confirmDialog}
      <CoachTour steps={TOUR_STEPS} open={tourOpen} onClose={() => setTourOpen(false)} />

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Spara taktiken</DialogTitle>
            <DialogDescription>
              Ge taktiken ett namn du känner igen den på, till exempel ”Uppspel från målvakt”.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <label className="text-sm font-semibold" htmlFor="tactic-name">
              Namn
            </label>
            <Input
              id="tactic-name"
              value={nameDraft}
              autoFocus
              onChange={(event) => setNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveWithName.mutate(nameDraft);
              }}
              placeholder="Namn på taktiken"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSaveOpen(false)}>
              Avbryt
            </Button>
            <Button
              disabled={saveWithName.isPending}
              onClick={() => saveWithName.mutate(nameDraft)}
            >
              {saveWithName.isPending ? "Sparar…" : "Spara"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border text-muted-foreground"
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
