import { useEffect, useState } from "react";
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

type Props = {
  teamId: string;
  userId: string | null;
  isCoach: boolean;
  type: "training" | "match";
  title: string;
};

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

function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function timeOnly(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
}

export function EventManager({ teamId, userId, isCoach, type, title }: Props) {
  const { confirm, confirmDialog } = useConfirm();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TeamEvent | null>(null);
  const [heading, setHeading] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [meetAt, setMeetAt] = useState("");
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

  useEffect(() => {
    if (open && !editing && !location && homeGround) setLocation(homeGround);
  }, [open, editing, location, homeGround]);

  function openNew() {
    setEditing(null);
    setHeading("");
    setStartsAt("");
    setEndsAt("");
    setMeetAt("");
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
    setEditing(event);
    setHeading(event.title ?? "");
    setStartsAt(toLocalInput(event.starts_at));
    setEndsAt(toLocalInput(event.ends_at));
    setMeetAt(toLocalInput(event.meet_at));
    setHomeTeam(event.home_team ?? "");
    setAwayTeam(event.away_team ?? "");
    setKit((event.kit as "home" | "away") ?? "home");
    setMatchKind(event.match_kind ?? MATCH_KINDS[0]!);
    setRepeat("none");
    setLocation(event.location ?? "");
    setNotes(event.notes ?? "");
    setOpen(true);
  }

  async function save() {
    if (!userId) return;
    if (!startsAt) {
      toast.error("Ange datum och starttid");
      return;
    }
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      toast.error("Sluttiden måste vara efter starttiden");
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
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        meet_at: type === "match" && meetAt ? new Date(meetAt).toISOString() : null,
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
        <h2 className="font-display text-2xl font-bold uppercase">{title}</h2>
        {isCoach && (
          <Button size="sm" onClick={openNew}>
            <Plus className="size-4" /> Nytt
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
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
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
                <Button size="icon" variant="ghost" onClick={() => {
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
          <div className="space-y-3">
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

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="e-time">Från</Label>
                <Input
                  id="e-time"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(event) => setStartsAt(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-end">Till</Label>
                <Input
                  id="e-end"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                />
              </div>
            </div>

            {type === "match" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="e-meet">Samling</Label>
                  <Input
                    id="e-meet"
                    type="datetime-local"
                    value={meetAt}
                    onChange={(event) => setMeetAt(event.target.value)}
                  />
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
          </div>
          <DialogFooter>
            <Button onClick={save} disabled={busy}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  {confirmDialog}
    </section>
  );
}
