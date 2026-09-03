import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Plus, Repeat, Shirt, Trash2, Users } from "lucide-react";
import {
  deleteEvent,
  fetchEvents,
  fetchTeam,
  formatDateTime,
  saveEvent,
  type TeamEvent,
} from "@/lib/teams";
import { Button } from "@/components/ui/button";
import { EventResources } from "@/components/EventResources";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/ConfirmDelete";
import { hasErrors, splitLocal, toIso, validateEventTimes } from "@/lib/event-datetime";


type Props = {
  teamId: string;
  userId: string | null;
  isCoach: boolean;
  type: "training" | "match";
  title: string;
  /** Text på knappen som öppnar formuläret. */
  newLabel?: string;
  /** Bekräftelse som visas när aktiviteten sparats. */
  savedMessage?: string;
  /** Dölj listan (när sidan visar aktiviteterna i en egen lista). */
  hideList?: boolean;
};

type ScheduleForm = {
  date: string;
  start: string;
  end: string;
  meet: string;
};

const emptySchedule: ScheduleForm = { date: "", start: "", end: "", meet: "" };

const MATCH_KINDS = [
  "Match S:t Eriks-Cupen – Stockholm",
  "Träningsmatch",
  "Cup",
  "Intern lagmatch",
];

const REPEATS = [
  { value: "none", label: "Ingen" },
  { value: "weekly", label: "Varje vecka" },
  { value: "monthly", label: "Varje månad" },
] as const;

function timeOnly(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

export function EventManager({ teamId, userId, isCoach, type, title, newLabel, savedMessage }: Props) {
  const { confirm, confirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamEvent | null>(null);
  const [heading, setHeading] = useState("");
  const [schedule, setSchedule] = useState<ScheduleForm>(emptySchedule);
  const [showErrors, setShowErrors] = useState(false);
  const [homeTeam, setHomeTeam] = useState("");
  const [awayTeam, setAwayTeam] = useState("");
  const [kit, setKit] = useState<"home" | "away">("home");
  const [matchKind, setMatchKind] = useState(MATCH_KINDS[0]!);
  const [repeat, setRepeat] = useState<"none" | "weekly" | "monthly">("none");
  const [repeatCount, setRepeatCount] = useState(8);
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const team = useQuery({ queryKey: ["team", teamId], queryFn: () => fetchTeam(teamId) });
  const homeGround = team.data?.home_ground ?? "";

  const events = useQuery({
    queryKey: ["events", teamId, type],
    queryFn: () => fetchEvents(teamId, type),
  });

  const errors = validateEventTimes({ ...schedule, meet: type === "match" ? schedule.meet : "" });
  const visibleErrors = showErrors ? errors : {};

  useEffect(() => {
    if (open && !editing && !location && homeGround) setLocation(homeGround);
  }, [open, editing, location, homeGround]);

  function openNew() {
    setEditing(null);
    setHeading("");
    setSchedule(emptySchedule);
    setShowErrors(false);
    setHomeTeam(type === "match" ? (team.data?.name ?? "") : "");
    setAwayTeam("");
    setKit("home");
    setMatchKind(MATCH_KINDS[0]!);
    setRepeat("none");
    setRepeatCount(8);
    setLocation(homeGround);
    setNotes("");
    setOpen(true);
  }

  function openEdit(event: TeamEvent) {
    const start = splitLocal(event.starts_at);
    setEditing(event);
    setHeading(event.title ?? "");
    setSchedule({
      date: start.date,
      start: start.time,
      end: splitLocal(event.ends_at).time,
      meet: splitLocal(event.meet_at).time,
    });
    setShowErrors(false);
    setHomeTeam(event.home_team ?? "");
    setAwayTeam(event.away_team ?? "");
    setKit((event.kit as "home" | "away") ?? "home");
    setMatchKind(event.match_kind ?? MATCH_KINDS[0]!);
    setRepeat("none");
    setLocation(event.location ?? "");
    setNotes(event.notes ?? "");
    setOpen(true);
  }

  function updateSchedule(field: keyof ScheduleForm, value: string) {
    setSchedule((current) => ({ ...current, [field]: value }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId) return;
    const submitted = new FormData(event.currentTarget);
    const submittedSchedule: ScheduleForm = {
      date: String(submitted.get("date") ?? ""),
      start: String(submitted.get("start") ?? ""),
      end: String(submitted.get("end") ?? ""),
      meet: type === "match" ? String(submitted.get("meet") ?? "") : "",
    };
    const submittedErrors = validateEventTimes(submittedSchedule);
    setSchedule(submittedSchedule);
    if (hasErrors(submittedErrors)) {
      setShowErrors(true);
      return;
    }
    const startsAtIso = toIso(submittedSchedule.date, submittedSchedule.start);
    if (!startsAtIso) {
      setShowErrors(true);
      return;
    }
    setBusy(true);
    try {
      await saveEvent({
        id: editing?.id,
        teamId,
        userId,
        type,
        title: heading.trim() || null,
        starts_at: startsAtIso,
        ends_at: submittedSchedule.end ? toIso(submittedSchedule.date, submittedSchedule.end) : null,
        meet_at:
          type === "match" && submittedSchedule.meet
            ? toIso(submittedSchedule.date, submittedSchedule.meet)
            : null,
        home_team: type === "match" ? homeTeam.trim() || null : null,
        away_team: type === "match" ? awayTeam.trim() || null : null,
        kit: type === "match" ? kit : null,
        match_kind: type === "match" ? matchKind : null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        repeat: editing ? "none" : repeat,
        repeatCount,
      });
      await queryClient.invalidateQueries({ queryKey: ["events", teamId] });
      toast.success(
        savedMessage ??
          (type === "training"
            ? "Träningen har lagts till i kalendern."
            : "Matchen har lagts till i kalendern."),
      );
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte spara");
    } finally {
      setBusy(false);
    }
  }


  const remove = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["events", teamId] }),
  });

  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold">{title}</h2>
        {isCoach && (
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" /> {newLabel ?? "Nytt"}
          </Button>
        )}
      </div>

      <ul className="mt-4 space-y-3">
        {events.data?.length === 0 && (
          <li className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            Inget inplanerat än.
          </li>
        )}
        {events.data?.map((event) => (
          <li key={event.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start gap-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => isCoach && openEdit(event)}>
                <p className="font-display text-lg font-semibold">
                  {event.title ??
                    (type === "match"
                      ? event.home_team && event.away_team
                        ? `${event.home_team} – ${event.away_team}`
                        : (event.match_kind ?? "Match")
                      : "Träning")}
                </p>
                {type === "match" && event.match_kind && (
                  <p className="text-xs tracking-wide text-muted-foreground">
                    {event.match_kind}
                  </p>
                )}
                <p className="text-sm text-primary">
                  {formatDateTime(event.starts_at)}
                  {event.ends_at ? ` – ${timeOnly(event.ends_at)}` : ""}
                </p>
                {event.meet_at && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3" /> Samling {timeOnly(event.meet_at)}
                  </p>
                )}
                {event.kit && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <Shirt className="size-3" /> {event.kit === "away" ? "Bortatröja" : "Hemmatröja"}
                  </p>
                )}
                {event.location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3" /> {event.location}
                  </p>
                )}
                {event.notes && <p className="mt-2 text-sm text-muted-foreground">{event.notes}</p>}
              </button>
              {isCoach && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={type === "match" ? "Radera matchen" : "Radera träningen"}
                  onClick={() => {
                    void confirm({
                      title: type === "match" ? "Radera match" : "Radera träning",
                      description: "Händelsen tas bort från lagets kalender permanent.",
                    }).then((ok) => ok && remove.mutate(event.id));
                  }}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
            {type === "training" && (
              <EventResources eventId={event.id} teamId={teamId} userId={userId} isCoach={isCoach} />
            )}
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{type === "training" ? "Träningstillfälle" : "Match"}</DialogTitle>
          </DialogHeader>
          <form id="event-form" className="space-y-3" onSubmit={save} noValidate>
            {type === "match" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="e-kind">Typ av match</Label>
                  <select
                    id="e-kind"
                    value={matchKind}
                    onChange={(event) => setMatchKind(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {MATCH_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="e-home">Hemmalag</Label>
                    <Input id="e-home" value={homeTeam} onChange={(e) => setHomeTeam(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="e-away">Bortalag</Label>
                    <Input id="e-away" value={awayTeam} onChange={(e) => setAwayTeam(e.target.value)} />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="e-title">Rubrik (frivillig)</Label>
              <Input
                id="e-title"
                placeholder={type === "training" ? "T.ex. Passningsträning" : "T.ex. Hemma mot IFK"}
                value={heading}
                onChange={(event) => setHeading(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-date">Datum</Label>
              <Input
                id="e-date"
                name="date"
                type="date"
                value={schedule.date}
                aria-invalid={Boolean(visibleErrors.date)}
                onChange={(event) => updateSchedule("date", event.target.value)}
              />
              {visibleErrors.date && <p className="text-sm text-destructive">{visibleErrors.date}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="e-time">Från</Label>
                <Input
                  id="e-time"
                  name="start"
                  type="time"
                  value={schedule.start}
                  aria-invalid={Boolean(visibleErrors.start)}
                  onChange={(event) => updateSchedule("start", event.target.value)}
                />
                {visibleErrors.start && <p className="text-sm text-destructive">{visibleErrors.start}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-end">Till (frivillig)</Label>
                <Input
                  id="e-end"
                  name="end"
                  type="time"
                  value={schedule.end}
                  aria-invalid={Boolean(visibleErrors.end)}
                  onChange={(event) => updateSchedule("end", event.target.value)}
                />
                {visibleErrors.end && <p className="text-sm text-destructive">{visibleErrors.end}</p>}
              </div>
            </div>

            {type === "match" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="e-meet">Samling (frivillig)</Label>
                  <Input
                    id="e-meet"
                    name="meet"
                    type="time"
                    value={schedule.meet}
                    aria-invalid={Boolean(visibleErrors.meet)}
                    onChange={(event) => updateSchedule("meet", event.target.value)}
                  />
                  {visibleErrors.meet && <p className="text-sm text-destructive">{visibleErrors.meet}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Tröja</Label>
                  <div className="flex gap-2">
                    {(["home", "away"] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setKit(option)}
                        className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                          kit === option
                            ? "border-primary bg-primary/15"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {option === "home" ? "Hemmatröja" : "Bortatröja"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {!editing && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Repeat className="size-3.5" /> Återkommande
                </Label>
                <div className="flex gap-2">
                  {REPEATS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRepeat(option.value)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                        repeat === option.value
                          ? "border-primary bg-primary/15"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {repeat !== "none" && (
                  <div className="flex items-center gap-2 pt-1">
                    <Label htmlFor="e-count" className="text-xs text-muted-foreground">
                      Antal tillfällen
                    </Label>
                    <Input
                      id="e-count"
                      type="number"
                      min={2}
                      max={52}
                      value={repeatCount}
                      onChange={(event) => setRepeatCount(Number(event.target.value))}
                      className="w-24"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="e-place">Plats</Label>
              <Input
                id="e-place"
                value={location}
                placeholder={homeGround || "T.ex. Långholmens IP"}
                onChange={(event) => setLocation(event.target.value)}
              />
              {homeGround && location !== homeGround && (
                <button
                  type="button"
                  onClick={() => setLocation(homeGround)}
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  Använd hemmaplan: {homeGround}
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="e-notes">Övrigt</Label>
              <Textarea
                id="e-notes"
                rows={3}
                placeholder="Ta med regnkläder, träningen är extra kort…"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </form>
          <DialogFooter>
            <Button type="submit" form="event-form" disabled={busy}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  {confirmDialog}
    </section>
  );
}
