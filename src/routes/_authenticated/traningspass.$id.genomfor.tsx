import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Pause, Play, Plus, SkipForward, Square } from "lucide-react";
import { toast } from "sonner";
import { fetchCoachSession, ITEM_KIND_LABELS, type ItemKind } from "@/lib/coach-sessions";
import { fetchSessionLinks } from "@/lib/event-planning";
import { fetchTeamPlayers } from "@/lib/teams";
import {
  addMinute,
  currentItemSeconds,
  fetchActiveRun,
  fetchRunAttendance,
  fetchRunItems,
  fetchRunPlayerNotes,
  finishRun,
  formatClock,
  goToItem,
  patchRun,
  pauseRun,
  remainingSeconds,
  resumeRun,
  runSummary,
  setRunAttendance,
  setRunPlayerNote,
  startRun,
  type RunAttendanceStatus,
  type SessionRun,
  type SessionRunItem,
} from "@/lib/session-runs";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/traningspass/$id/genomfor")({
  head: () => ({
    meta: [
      { title: "Genomför träning – steg för steg" },
      {
        name: "description",
        content: "Kör träningen live med timer, aktuell övning, närvaro och anteckningar direkt på plan.",
      },
      { property: "og:title", content: "Genomför träning" },
      { property: "og:description", content: "Timer, moment, närvaro och anteckningar under träningen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RunSession,
});

const ATTENDANCE_CHOICES: { value: RunAttendanceStatus; label: string }[] = [
  { value: "present", label: "Här" },
  { value: "partial", label: "Del" },
  { value: "absent", label: "Borta" },
];

function RunSession() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const session = useQuery({ queryKey: ["coach-session", id], queryFn: () => fetchCoachSession(id) });
  const links = useQuery({ queryKey: ["session-links", id], queryFn: () => fetchSessionLinks([id]) });
  const run = useQuery({ queryKey: ["session-run", id], queryFn: () => fetchActiveRun(id) });
  const runId = run.data?.id ?? null;

  const items = useQuery({
    queryKey: ["session-run-items", runId],
    queryFn: () => fetchRunItems(runId as string),
    enabled: !!runId,
  });

  const teamId = run.data?.team_id ?? session.data?.team_id ?? null;
  const players = useQuery({
    queryKey: ["team-players", teamId],
    queryFn: () => fetchTeamPlayers(teamId as string),
    enabled: !!teamId,
  });
  const attendance = useQuery({
    queryKey: ["run-attendance", runId],
    queryFn: () => fetchRunAttendance(runId as string),
    enabled: !!runId,
  });
  const playerNotes = useQuery({
    queryKey: ["run-player-notes", runId],
    queryFn: () => fetchRunPlayerNotes(runId as string),
    enabled: !!runId,
  });

  const [tick, setTick] = useState(() => Date.now());
  const [generalNote, setGeneralNote] = useState("");
  const [noteTouched, setNoteTouched] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [finishedSummary, setFinishedSummary] = useState<{
    plannedSeconds: number;
    actualSeconds: number;
    done: number;
    skipped: number;
    attendance: number;
  } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (run.data && !noteTouched) setGeneralNote(run.data.general_note ?? "");
  }, [run.data, noteTouched]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["session-run", id] });
    queryClient.invalidateQueries({ queryKey: ["session-run-items", runId] });
  };

  const begin = useMutation({
    mutationFn: () => startRun(id, links.data?.[0]?.event_id ?? null),
    onSuccess: () => {
      refresh();
      toast.success("Träningen är igång");
    },
    onError: (error: Error) => toast.error(error.message || "Det gick inte att starta träningen."),
  });

  const control = useMutation({
    mutationFn: async (action: "pause" | "resume" | "prev" | "next" | "skip" | "plus") => {
      const current = run.data;
      const list = items.data ?? [];
      if (!current) return;
      if (action === "pause") return pauseRun(current);
      if (action === "resume") return resumeRun(current);
      if (action === "plus") {
        const item = list[current.current_index];
        if (item) return addMinute(item);
        return;
      }
      if (action === "prev") {
        return goToItem({ run: current, items: list, nextIndex: current.current_index - 1, leaveStatus: "pending" });
      }
      return goToItem({
        run: current,
        items: list,
        nextIndex: current.current_index + 1,
        leaveStatus: action === "skip" ? "skipped" : "done",
      });
    },
    onSuccess: refresh,
    onError: () => toast.error("Det gick inte att spara ändringen. Försök igen."),
  });

  const saveNote = useMutation({
    mutationFn: (value: string) => patchRun(runId as string, { general_note: value }),
    onError: () => toast.error("Anteckningen kunde inte sparas."),
  });

  const savePlayerNote = useMutation({
    mutationFn: ({ playerId, note }: { playerId: string; note: string }) =>
      setRunPlayerNote(runId as string, playerId, note),
    onError: () => toast.error("Spelaranteckningen kunde inte sparas."),
  });

  const mark = useMutation({
    mutationFn: ({ playerId, status }: { playerId: string; status: RunAttendanceStatus }) =>
      setRunAttendance(runId as string, playerId, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["run-attendance", runId] }),
    onError: () => toast.error("Närvaron kunde inte sparas."),
  });

  const end = useMutation({
    mutationFn: async () => {
      if (!run.data || !user) return;
      if (generalNote !== (run.data.general_note ?? "")) await patchRun(run.data.id, { general_note: generalNote });
      await finishRun({ run: run.data, items: items.data ?? [], userId: user.id });
    },
    onSuccess: () => {
      const done = runSummary(items.data ?? []);
      setFinishedSummary({ ...done, attendance: attendance.data?.length ?? 0 });
      setConfirmEnd(false);
      setSummaryOpen(true);
      queryClient.invalidateQueries({ queryKey: ["coach-session", id] });
      queryClient.invalidateQueries({ queryKey: ["coach-sessions"] });
      refresh();
      toast.success("Träningen är avslutad och sparad");
    },
    onError: () => toast.error("Det gick inte att avsluta träningen."),
  });

  const list = items.data ?? [];
  const active: SessionRun | null = run.data ?? null;
  const current = active ? list[active.current_index] : undefined;
  const next = active ? list[active.current_index + 1] : undefined;
  const elapsed = active ? currentItemSeconds(active, list, tick) : 0;
  const left = current ? remainingSeconds(current.planned_minutes, elapsed) : 0;
  const summary = useMemo(() => runSummary(list), [list]);
  const attendanceMap = new Map((attendance.data ?? []).map((row) => [row.player_id, row.status]));
  const noteMap = new Map((playerNotes.data ?? []).map((row) => [row.player_id, row.note]));

  function changeNote(value: string) {
    setNoteTouched(true);
    setGeneralNote(value);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => runId && saveNote.mutate(value), 800);
  }

  const summaryDialog = (
    <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sammanfattning</DialogTitle>
        </DialogHeader>
        <ul className="space-y-1 text-sm">
          <li>Planerad tid: {Math.round((finishedSummary ?? summary).plannedSeconds / 60)} min</li>
          <li>Faktisk tid: {Math.round((finishedSummary ?? summary).actualSeconds / 60)} min</li>
          <li>Genomförda moment: {(finishedSummary ?? summary).done}</li>
          <li>Överhoppade moment: {(finishedSummary ?? summary).skipped}</li>
          <li>Närvaroregistreringar: {finishedSummary?.attendance ?? attendance.data?.length ?? 0}</li>
        </ul>
        <DialogFooter>
          <Button
            onClick={() => {
              setSummaryOpen(false);
              navigate({ to: "/planera-traning" });
            }}
          >
            Till träningsplaneringen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (session.isLoading || run.isLoading) {
    return <main className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted-foreground">Laddar träningen…</main>;
  }

  if (!session.data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Träningspasset kunde inte hittas.</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/traningspass">Tillbaka till Mina träningar</Link>
        </Button>
      </main>
    );
  }

  if (!active) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="font-display text-xs tracking-[0.3em] text-primary">Genomför träning</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{session.data.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Inget genomförande pågår. När du startar körs passet steg för steg med timer, närvaro och anteckningar.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="lg" onClick={() => begin.mutate()} disabled={begin.isPending}>
            <Play className="mr-2 size-5" /> Starta träning
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/traningspass/$id" params={{ id }}>
              Till träningsplaneringen
            </Link>
          </Button>
        </div>
        {summaryDialog}
      </main>
    );
  }

  const paused = Boolean(active.paused_at);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-28 pt-6">
      <header>
        <p className="font-display text-xs tracking-[0.3em] text-primary">Genomför träning</p>
        <h1 className="mt-1 font-display text-2xl font-bold">{session.data.title}</h1>
        <p className="text-sm text-muted-foreground">
          Moment {Math.min(active.current_index + 1, list.length)} av {list.length}
          {paused ? " · Pausad" : ""}
        </p>
      </header>

      <section className="mt-5 rounded-2xl border border-border bg-card p-5 text-center">
        <p className="text-sm text-muted-foreground">{current ? ITEM_KIND_LABELS[current.kind as ItemKind] : "Klart"}</p>
        <h2 className="mt-1 font-display text-2xl font-bold">{current?.title ?? "Alla moment är genomförda"}</h2>
        <p className="mt-4 font-display text-6xl font-bold tabular-nums" aria-live="polite">
          {formatClock(left)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {left < 0 ? "Övertid" : "Kvar av momentet"} · planerat {current?.planned_minutes ?? 0} min · totalt{" "}
          {formatClock(elapsed)} på detta moment
        </p>
        {current?.note && (
          <p className="mt-4 whitespace-pre-line rounded-xl bg-muted/60 p-3 text-left text-sm">{current.note}</p>
        )}
        {current?.resource_id && current.kind === "drill" && (
          <Link
            to="/ovningsbank/$drillId"
            params={{ drillId: current.resource_id }}
            className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Öppna övningen med organisation och material
          </Link>
        )}
        {current?.resource_id && current.kind === "tactic" && (
          <Link
            to="/taktikbank/$cardId"
            params={{ cardId: current.resource_id }}
            className="mt-3 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Öppna taktiktavlan
          </Link>
        )}
        <p className="mt-4 text-sm text-muted-foreground">
          Nästa: <span className="font-medium text-foreground">{next ? next.title : "Avsluta träningen"}</span>
        </p>
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button
          size="lg"
          className="h-14"
          onClick={() => control.mutate(paused ? "resume" : "pause")}
          aria-label={paused ? "Fortsätt träningen" : "Pausa träningen"}
        >
          {paused ? <Play className="mr-2 size-5" /> : <Pause className="mr-2 size-5" />}
          {paused ? "Fortsätt" : "Pausa"}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14"
          onClick={() => control.mutate("prev")}
          disabled={active.current_index === 0}
          aria-label="Föregående moment"
        >
          <ChevronLeft className="mr-2 size-5" /> Föregående
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14"
          onClick={() => control.mutate("next")}
          disabled={!next}
          aria-label="Nästa moment"
        >
          <ChevronRight className="mr-2 size-5" /> Nästa
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14"
          onClick={() => control.mutate("skip")}
          disabled={!next}
          aria-label="Hoppa över momentet"
        >
          <SkipForward className="mr-2 size-5" /> Hoppa över
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14"
          onClick={() => control.mutate("plus")}
          aria-label="Lägg till en minut"
        >
          <Plus className="mr-2 size-5" /> 1 min
        </Button>
        <Button
          size="lg"
          variant="destructive"
          className="h-14"
          onClick={() => setConfirmEnd(true)}
          aria-label="Avsluta träningen"
        >
          <Square className="mr-2 size-5" /> Avsluta
        </Button>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Momenten</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {list.map((item, index) => (
            <li
              key={item.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                index === active.current_index ? "bg-primary/10 font-medium" : ""
              }`}
            >
              <span>
                {index + 1}. {item.title}
              </span>
              <span className="text-muted-foreground">
                {item.status === "skipped"
                  ? "Överhoppad"
                  : item.status === "done"
                    ? `${formatClock(item.actual_seconds)}`
                    : `${item.planned_minutes} min`}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {teamId && (
        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="font-display text-lg font-semibold">Närvaro</h2>
          <p className="text-sm text-muted-foreground">
            Registrera vilka som är med. Närvaron sparas direkt och förs över till lagets aktivitet när du avslutar.
          </p>
          <ul className="mt-3 space-y-2">
            {(players.data ?? [])
              .filter((player) => player.is_active !== false)
              .map((player) => (
                <li key={player.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{player.name}</span>
                    <div className="flex gap-1">
                      {ATTENDANCE_CHOICES.map((choice) => (
                        <Button
                          key={choice.value}
                          size="sm"
                          className="h-10 min-w-16"
                          variant={attendanceMap.get(player.id) === choice.value ? "default" : "outline"}
                          onClick={() => mark.mutate({ playerId: player.id, status: choice.value })}
                        >
                          {choice.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Textarea
                    className="mt-2"
                    rows={2}
                    placeholder="Privat observation (syns bara för lagets ledare)"
                    defaultValue={noteMap.get(player.id) ?? ""}
                    onBlur={(event) => savePlayerNote.mutate({ playerId: player.id, note: event.target.value })}
                  />
                </li>
              ))}
            {(players.data ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">Laget har inga spelare i truppen ännu.</li>
            )}
          </ul>
        </section>
      )}

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <h2 className="font-display text-lg font-semibold">Anteckningar om träningen</h2>
        <Textarea
          className="mt-2"
          rows={4}
          value={generalNote}
          placeholder="Vad fungerade? Vad tar vi med till nästa gång?"
          onChange={(event) => changeNote(event.target.value)}
        />
      </section>

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avsluta träningen?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tider, moment, närvaro och anteckningar sparas och passet markeras som genomfört.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEnd(false)}>
              Avbryt
            </Button>
            <Button onClick={() => end.mutate()} disabled={end.isPending}>
              <Check className="mr-2 size-4" /> Avsluta och spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {summaryDialog}
    </main>
  );
}
