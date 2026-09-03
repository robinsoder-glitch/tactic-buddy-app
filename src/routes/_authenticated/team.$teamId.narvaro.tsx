import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarCheck, ChevronRight, ListChecks, Users } from "lucide-react";
import { toast } from "sonner";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_SHORT,
  ATTENDANCE_STATUSES,
  eventLabel,
  fetchEventAttendance,
  fetchTeamAttendance,
  minutesFromShare,
  pastEvents,
  playingTimeShare,
  PLAYING_TIME_PRESETS,
  registeredCount,
  setMatchDuration,
  validateMinutes,
} from "@/lib/attendance";
import {
  ABSENCE_REASONS,
  ABSENCE_REASON_LABELS,
  ABSENCE_REASON_UNSET,
  EMPTY_ENTRY,
  attendanceStarted,
  counterLabel,
  draftFromInvitations,
  draftFromRows,
  isDirty,
  markAll,
  saveEventAttendance,
  setEntry,
  toPayload,
  type Draft,
} from "@/lib/attendance-draft";
import { fetchEventInvitations } from "@/lib/invitations";
import { fetchEvents, fetchTeamPlayers, formatDateTime } from "@/lib/teams";
import { useTeamRole } from "@/hooks/useTeamRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Search = { handelse?: string | undefined; visa?: "alla" | "traning" | "match" | undefined };

export const Route = createFileRoute("/_authenticated/team/$teamId/narvaro")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const visa = search["visa"];
    const handelse = search["handelse"];
    return {
      visa: visa === "traning" || visa === "match" || visa === "alla" ? visa : undefined,
      handelse: typeof handelse === "string" && handelse ? handelse : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Närvaro – registrera träningar och matcher" },
      {
        name: "description",
        content:
          "Registrera närvaro för varje träning och match i lagets kalender och se direkt hur många som deltog.",
      },
      { property: "og:title", content: "Närvaro" },
      { property: "og:description", content: "Klicka på en händelse och pricka av truppen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { teamId } = useParams({ from: "/_authenticated/team/$teamId/narvaro" });
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { isCoach: isTeamCoach, canManageAttendance, userId } = useTeamRole(teamId);
  const isCoach = canManageAttendance || isTeamCoach;
  const queryClient = useQueryClient();

  const events = useQuery({ queryKey: ["events", teamId], queryFn: () => fetchEvents(teamId) });
  const players = useQuery({
    queryKey: ["team-players", teamId],
    queryFn: () => fetchTeamPlayers(teamId),
  });
  const attendance = useQuery({
    queryKey: ["attendance", teamId],
    queryFn: () => fetchTeamAttendance(teamId),
  });

  const filter = search.visa ?? "alla";
  const list = useMemo(() => {
    const all = events.data ?? [];
    const done = pastEvents(all)
      .filter((event) =>
        filter === "alla"
          ? true
          : filter === "traning"
            ? event.type === "training"
            : event.type === "match",
      )
      .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    return done;
  }, [events.data, filter]);

  const selected = (events.data ?? []).find((event) => event.id === search.handelse) ?? null;

  if (selected) {
    return (
      <>
        <Link
          to="/team/$teamId/event/$eventId"
          params={{ teamId, eventId: selected.id }}
          className="mt-4 inline-block text-sm text-primary underline"
        >
          Visa kallelsen och deltagarsvaren
        </Link>
        <EventAttendance
          teamId={teamId}
          userId={userId}
          isCoach={isCoach}
          eventId={selected.id}
          eventType={selected.type}
          durationMinutes={selected.match_duration_minutes ?? null}
          heading={eventLabel(selected)}
          subheading={`${formatDateTime(selected.starts_at)}${selected.location ? ` · ${selected.location}` : ""}`}
          players={(players.data ?? []).map((player) => ({
            id: player.id,
            name: player.name,
            number: player.number,
          }))}
          onBack={() => navigate({ search: (prev) => ({ ...prev, handelse: undefined }) })}
          onChanged={() => {
            queryClient.invalidateQueries({ queryKey: ["attendance", teamId] });
          }}
        />
      </>
    );
  }

  const rows = attendance.data ?? [];

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-xl font-bold">Närvaro</h2>
          <p className="text-sm text-muted-foreground">
            Välj en träning eller match och pricka av truppen. Kommande händelser visas när de har
            startat.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/team/$teamId/statistik" params={{ teamId }}>
            Statistik
          </Link>
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            ["alla", "Alla"],
            ["traning", "Träningar"],
            ["match", "Matcher"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => navigate({ search: (prev) => ({ ...prev, visa: value }) })}
            className={`rounded-full border px-3 py-1 text-sm ${
              filter === value
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {events.isLoading && <p className="mt-4 text-sm text-muted-foreground">Laddar kalendern…</p>}

      {!events.isLoading && list.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
          <CalendarCheck className="mx-auto size-8 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            Det finns inga genomförda träningar eller matcher att registrera närvaro på ännu.
          </p>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {list.map((event) => {
          const registered = registeredCount(rows, event.id);
          return (
            <li key={event.id}>
              <Link
                to="/team/$teamId/narvaro"
                params={{ teamId }}
                search={{ visa: filter, handelse: event.id }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary"
                aria-label={`Registrera närvaro för ${eventLabel(event)}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs tracking-wide text-muted-foreground">
                    {event.type === "training" ? "Träning" : "Match"} ·{" "}
                    {formatDateTime(event.starts_at)}
                  </p>
                  <p className="font-display text-base font-semibold">{eventLabel(event)}</p>
                  <p className="text-xs text-muted-foreground">
                    {registered > 0
                      ? `${registered} av ${(players.data ?? []).length} spelare registrerade`
                      : "Ingen närvaro registrerad ännu"}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EventAttendance({
  teamId,
  isCoach,
  eventId,
  eventType,
  durationMinutes,
  heading,
  subheading,
  players,
  onBack,
  onChanged,
}: {
  teamId: string;
  userId: string | null;
  isCoach: boolean;
  eventId: string;
  eventType: "training" | "match";
  durationMinutes: number | null;
  heading: string;
  subheading: string;
  players: { id: string; name: string; number: number | null }[];
  onBack: () => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const playerIds = useMemo(() => players.map((player) => player.id), [players]);
  const [durationDraft, setDurationDraft] = useState(
    durationMinutes ? String(durationMinutes) : "",
  );
  const [onlyUnregistered, setOnlyUnregistered] = useState(false);
  const [draft, setDraft] = useState<Draft>({});

  const rows = useQuery({
    queryKey: ["attendance-event", eventId],
    queryFn: () => fetchEventAttendance(eventId),
  });
  const invitations = useQuery({
    queryKey: ["invitations", eventId],
    queryFn: () => fetchEventInvitations(eventId),
  });

  // Sparat läge är facit – utkastet återställs när servern svarar.
  const saved = useMemo(() => draftFromRows(playerIds, rows.data ?? []), [playerIds, rows.data]);
  useEffect(() => {
    setDraft(saved);
  }, [saved]);

  const dirty = isDirty(draft, saved);
  const started = attendanceStarted(rows.data ?? []);

  // Varna innan sidan lämnas med osparade ändringar.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const saveDuration = useMutation({
    mutationFn: async (minutes: number) => setMatchDuration(eventId, minutes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events", teamId] });
      toast.success("Matchens längd sparades.");
    },
    onError: () => toast.error("Det gick inte att spara matchens längd."),
  });

  const save = useMutation({
    mutationFn: async () => {
      for (const entry of Object.values(draft)) {
        if (eventType !== "match" || entry.status === "absent") continue;
        const error = validateMinutes(entry.minutes, durationMinutes);
        if (error) throw new Error(error);
      }
      return saveEventAttendance({
        eventId,
        teamId,
        rows: toPayload(draft, eventType),
      });
    },
    onSuccess: async (count) => {
      toast.success(`Närvaron sparades för ${count} spelare.`);
      await queryClient.invalidateQueries({ queryKey: ["attendance-event", eventId] });
      onChanged();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Det gick inte att spara närvaron."),
  });

  const prepare = () => {
    setDraft(
      draftFromInvitations(
        playerIds,
        (invitations.data ?? []).map((invite) => ({
          player_id: invite.player_id,
          status: invite.status,
        })),
        rows.data ?? [],
      ),
    );
    toast.info("Förslaget bygger på kallelsesvaren. Kontrollera vilka som deltog innan du sparar.");
  };

  const visible = onlyUnregistered
    ? players.filter((player) => (draft[player.id]?.status ?? null) === null)
    : players;

  return (
    <section className="mt-4 pb-28">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Tillbaka till närvarolistan"
          onClick={onBack}
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-bold">{heading}</h2>
          <p className="text-xs text-muted-foreground">{subheading}</p>
        </div>
      </div>

      <p className="mt-3 text-sm font-medium">{counterLabel(draft, players.length)}</p>

      {isCoach && (
        <div className="mt-3 rounded-xl border border-border bg-card p-3">
          {started ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Närvaro är redan påbörjad.</span> Redan
              sparade spelare behåller sin registrering.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Förslaget bygger på kallelsesvaren. Kontrollera vilka som faktiskt deltog innan du
              sparar.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={prepare}>
              <ListChecks className="size-4" /> Förbered från kallelsesvaren
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDraft((current) => markAll(current, "present"))}
            >
              <Users className="size-4" /> Markera alla närvarande
            </Button>
            <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setDraft(saved)}>
              Rensa osparade ändringar
            </Button>
            <Button
              size="sm"
              variant={onlyUnregistered ? "default" : "ghost"}
              aria-pressed={onlyUnregistered}
              onClick={() => setOnlyUnregistered((value) => !value)}
            >
              Ej registrerade
            </Button>
          </div>
        </div>
      )}

      {eventType === "match" && (
        <div className="mt-3 rounded-xl border border-border bg-card p-3">
          <label htmlFor="match-duration" className="text-sm font-medium">
            Matchens längd (minuter)
          </label>
          <p className="text-xs text-muted-foreground">
            Behövs för snabbvalen av speltid. Speltiden visas bara för lagets ledare.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id="match-duration"
              type="number"
              min={1}
              inputMode="numeric"
              className="w-28"
              disabled={!isCoach}
              value={durationDraft}
              onChange={(event) => setDurationDraft(event.target.value)}
            />
            {isCoach && (
              <Button
                size="sm"
                variant="outline"
                disabled={saveDuration.isPending}
                onClick={() => {
                  const minutes = Number(durationDraft);
                  if (!Number.isInteger(minutes) || minutes <= 0) {
                    toast.error("Ange matchens längd i hela minuter.");
                    return;
                  }
                  saveDuration.mutate(minutes);
                }}
              >
                Spara längd
              </Button>
            )}
          </div>
        </div>
      )}

      {players.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Laget har inga spelare i truppen ännu.
        </p>
      )}

      {players.length > 0 && visible.length === 0 && (
        <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Alla spelare är registrerade.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {visible.map((player) => {
          const entry = draft[player.id] ?? EMPTY_ENTRY;
          const current = entry.status;
          return (
            <li key={player.id} className="rounded-xl border border-border bg-card p-3">
              <p className="font-display text-base font-semibold">
                {player.number != null ? `${player.number}. ` : ""}
                {player.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {current ? ATTENDANCE_LABELS[current] : "Ej registrerad"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ATTENDANCE_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={!isCoach}
                    aria-pressed={current === status}
                    aria-label={`${ATTENDANCE_LABELS[status]} för ${player.name}`}
                    onClick={() =>
                      setDraft((value) =>
                        setEntry(value, player.id, {
                          status: current === status ? null : status,
                        }),
                      )
                    }
                    className={`rounded-full border px-3 py-1 text-sm disabled:opacity-60 ${
                      current === status
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {ATTENDANCE_SHORT[status]}
                  </button>
                ))}
              </div>

              {isCoach && current === "absent" && (
                <div className="mt-3 border-t border-border pt-2">
                  <p className="text-xs font-medium text-muted-foreground">Orsak (valfritt)</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {ABSENCE_REASONS.map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        aria-pressed={entry.reason === reason}
                        onClick={() =>
                          setDraft((value) =>
                            setEntry(value, player.id, {
                              reason: entry.reason === reason ? null : reason,
                            }),
                          )
                        }
                        className={`rounded-full border px-3 py-1 text-xs ${
                          entry.reason === reason
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        {ABSENCE_REASON_LABELS[reason]}
                      </button>
                    ))}
                    <span className="self-center text-xs text-muted-foreground">
                      {entry.reason ? "" : ABSENCE_REASON_UNSET}
                    </span>
                  </div>
                </div>
              )}

              {eventType === "match" && isCoach && current && current !== "absent" && (
                <div className="mt-3 border-t border-border pt-2">
                  <p className="text-xs font-medium text-muted-foreground">Speltid</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {PLAYING_TIME_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        aria-label={`${preset.label} för ${player.name}`}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                        onClick={() => {
                          const minutes = minutesFromShare(preset.share, durationMinutes);
                          if (minutes === null) {
                            toast.error("Ange matchens längd först.");
                            return;
                          }
                          setDraft((value) => setEntry(value, player.id, { minutes }));
                        }}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <Input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className="h-8 w-24"
                      aria-label={`Exakta minuter för ${player.name}`}
                      value={entry.minutes ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        setDraft((value) =>
                          setEntry(value, player.id, {
                            minutes: raw === "" ? null : Number(raw),
                          }),
                        );
                      }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        const share = playingTimeShare(entry.minutes, durationMinutes);
                        return share === null ? "min" : `min · ${share} % av matchen`;
                      })()}
                    </span>
                  </div>
                </div>
              )}

              {isCoach && current && (
                <Input
                  className="mt-2 h-8 text-sm"
                  maxLength={300}
                  placeholder="Kort intern notering (valfritt)"
                  aria-label={`Notering för ${player.name}`}
                  value={entry.note}
                  onChange={(event) =>
                    setDraft((value) => setEntry(value, player.id, { note: event.target.value }))
                  }
                />
              )}
            </li>
          );
        })}
      </ul>

      {isCoach && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {dirty ? "Du har osparade ändringar." : "Allt är sparat."}
            </p>
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Sparar…" : "Spara närvaro"}
            </Button>
          </div>
        </div>
      )}

      {!isCoach && (
        <p className="mt-4 text-xs text-muted-foreground">
          Endast lagets tränare kan ändra närvaron. Du ser registreringen som den är sparad.
        </p>
      )}
    </section>
  );
}
