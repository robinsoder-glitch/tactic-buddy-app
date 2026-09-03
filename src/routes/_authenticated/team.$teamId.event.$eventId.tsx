import { useMemo, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { EventCoaches } from "@/components/EventCoaches";
import { EventResources } from "@/components/EventResources";
import { PlanStatusBadge } from "@/components/PlanStatusBadge";
import { planStatus } from "@/lib/plan-status";
import { fetchEventPlan, fetchEventResources, fetchSquad } from "@/lib/planning";
import { fetchEventCoaches } from "@/lib/event-coaches";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Bell, CalendarDays, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { fetchEvent, fetchTeamPlayers, formatDateTime } from "@/lib/teams";
import {
  INVITE_STATUSES,
  NO_ACCOUNT_TEXT,
  NO_REMINDER_TEXT,
  canRespondAsGuardian,
  canRespondSelf,
  countInvitations,
  createReminders,
  reminderResultText,
  summaryText,
  setRespondBy,
  fetchInvitationLog,
  EXTERNAL_CHANNELS_TEXT,
  expectedAttendance,
  fetchEventInvitations,
  inviteStatusLabel,
  respondToInvitation,
  saveInvitationPlan,
  setEventCancelled,
  type InviteStatus,
  type Invitation,
} from "@/lib/invitations";

import { useTeamRole } from "@/hooks/useTeamRole";
import { fetchMyGuardedPlayerIds } from "@/lib/guardians";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/team/$teamId/event/$eventId")({
  head: () => ({
    meta: [
      { title: "Aktivitet – kallelse och deltagare" },
      {
        name: "description",
        content:
          "Se tid, plats och kallelse för en träning eller match, och håll koll på vilka spelare som kommer.",
      },
      { property: "og:title", content: "Kallelse och deltagare" },
      {
        property: "og:description",
        content: "Vilka kommer, kommer inte, kanske eller har inte svarat.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EventPage,
});

type Filter = "alla" | InviteStatus;

function EventPage() {
  const { teamId, eventId } = useParams({ from: "/_authenticated/team/$teamId/event/$eventId" });
  const { isCoach, userId } = useTeamRole(teamId);
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<Filter>("alla");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [respondBy, setRespondByValue] = useState("");

  const event = useQuery({ queryKey: ["event", eventId], queryFn: () => fetchEvent(eventId) });
  const players = useQuery({
    queryKey: ["team-players", teamId],
    queryFn: () => fetchTeamPlayers(teamId),
  });
  const plan = useQuery({
    queryKey: ["event-plan", eventId],
    queryFn: () => fetchEventPlan(eventId),
  });
  const planResources = useQuery({
    queryKey: ["event-resources", eventId],
    queryFn: () => fetchEventResources([eventId]),
  });
  const eventSquad = useQuery({
    queryKey: ["event-squad", eventId],
    queryFn: () => fetchSquad(eventId),
  });
  const planCoaches = useQuery({
    queryKey: ["event-coaches", eventId],
    queryFn: () => fetchEventCoaches([eventId]),
  });
  const guarded = useQuery({
    queryKey: ["guarded-players", userId],
    queryFn: () => fetchMyGuardedPlayerIds(userId),
    enabled: Boolean(userId),
  });
  const invites = useQuery({
    queryKey: ["invitations", eventId],
    queryFn: () => fetchEventInvitations(eventId),
  });

  const list = useMemo(() => invites.data ?? [], [invites.data]);
  const guardedIds = guarded.data ?? [];
  const counts = countInvitations(list);
  const cancelled = Boolean(event.data?.cancelled_at);
  const meta = list[0];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["invitations", eventId] });
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Du måste vara inloggad.");
      const invited = new Set(list.map((item) => item.player_id));
      const newPlayerIds = selected.filter((id) => !invited.has(id));
      // Utan befintlig kallelse och utan valda spelare finns inget att spara.
      if (list.length === 0 && newPlayerIds.length === 0) {
        throw new Error("NO_PLAYERS_SELECTED");
      }
      const result = await saveInvitationPlan({
        eventId,
        teamId,
        hasExisting: list.length > 0,
        newPlayerIds,
        message: message.trim() || null,
        respondBy: respondBy || null,
        createdBy: userId,
      });

      // Verifiera mot databasen innan vi visar ett lyckat meddelande.
      await queryClient.invalidateQueries({ queryKey: ["invitations", eventId] });
      const saved = await queryClient.fetchQuery({
        queryKey: ["invitations", eventId],
        queryFn: () => fetchEventInvitations(eventId),
      });
      if (saved.length === 0) throw new Error("INVITATION_NOT_SAVED");
      return result;
    },
    onSuccess: (result) => {
      setCreating(false);
      toast.success(
        result.added > 0
          ? `Kallelsen är uppdaterad (${result.added} nya).`
          : "Kallelsen är uppdaterad.",
      );
    },
    onError: (error: Error) => {
      toast.error(
        error.message === "NO_PLAYERS_SELECTED"
          ? "Välj minst en spelare innan du sparar kallelsen."
          : "Kunde inte spara kallelsen. Försök igen.",
      );
    },
  });

  const respond = useMutation({
    mutationFn: ({ invitation, status }: { invitation: Invitation; status: InviteStatus }) => {
      if (!userId) throw new Error("Du måste vara inloggad.");
      return respondToInvitation({
        invitation,
        status,
        userId,
        role: isCoach ? "coach" : canRespondSelf(invitation, userId) ? "player" : "guardian",
      });
    },
    onSuccess: (_data, vars) => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ["invitation-log", vars.invitation.id] });
    },
    onError: () =>
      toast.error(
        cancelled
          ? "Aktiviteten är inställd. Det går inte att lämna nya svar."
          : "Kunde inte spara svaret. Försök igen.",
      ),
  });

  const remind = useMutation({
    mutationFn: () =>
      createReminders({
        eventId,
        title: "Påminnelse: svara på kallelsen",
        body: `${event.data?.type === "match" ? "Match" : "Träning"} ${formatDateTime(event.data?.starts_at ?? "")}`,
      }),
    onSuccess: (result) => {
      const text = reminderResultText(result);
      if (result.sent > 0) toast.success(text);
      else toast.info(text);
      refresh();
    },
    onError: () => toast.error("Kunde inte skapa påminnelsen. Försök igen."),
  });

  const saveRespondBy = useMutation({
    mutationFn: () => setRespondBy(eventId, respondBy || null),
    onSuccess: () => {
      toast.success("Sista svarsdag uppdaterad. Tidigare svar är kvar.");
      refresh();
    },
    onError: () => toast.error("Kunde inte spara sista svarsdag."),
  });

  const cancel = useMutation({
    mutationFn: (value: boolean) => setEventCancelled(eventId, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["event", eventId] }),
    onError: () => toast.error("Kunde inte ändra aktiviteten. Försök igen."),
  });

  const lastReminder = useMemo(() => {
    const stamps = list.map((item) => item.last_reminder_at).filter(Boolean) as string[];
    return stamps.sort().at(-1) ?? null;
  }, [list]);

  const filtered = useMemo(
    () => (filter === "alla" ? list : list.filter((item) => item.status === filter)),
    [list, filter],
  );

  function openDialog() {
    const invited = new Set(list.map((item) => item.player_id));
    setSelected((players.data ?? []).map((player) => player.id).filter((id) => !invited.has(id)));
    setMessage(meta?.message ?? "");
    setRespondByValue(meta?.respond_by ?? "");

    setCreating(true);
  }

  if (event.isError) {
    return (
      <main className="mx-auto max-w-2xl px-4 pb-28 pt-8">
        <p className="text-sm text-muted-foreground">Aktiviteten kunde inte hämtas just nu.</p>
        <Button className="mt-3" onClick={() => event.refetch()}>
          Försök igen
        </Button>
      </main>
    );
  }

  const title =
    event.data?.title ??
    (event.data?.type === "match"
      ? `${event.data?.home_team ?? "Hemma"} – ${event.data?.away_team ?? "Borta"}`
      : "Träning");

  return (
    <main className="mx-auto max-w-2xl px-4 pb-28 pt-6">
      <Link
        to="/team/$teamId/calendar"
        params={{ teamId }}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> Tillbaka till aktiviteter
      </Link>

      <header className="mt-3">
        {cancelled && (
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-destructive/15 px-3 py-1 text-xs font-semibold text-destructive">
            <Ban className="size-3.5" /> Inställd
          </p>
        )}
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-4" />
            {event.data ? formatDateTime(event.data.starts_at) : "Laddar…"}
          </span>
          {event.data?.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" />
              {event.data.location}
            </span>
          )}
        </p>
        {event.data?.notes && <p className="mt-2 text-sm">{event.data.notes}</p>}
        {isCoach && event.data && (
          <Button
            variant={cancelled ? "secondary" : "ghost"}
            size="sm"
            className="mt-3"
            onClick={() => cancel.mutate(!cancelled)}
          >
            {cancelled ? "Aktivera aktiviteten igen" : "Ställ in aktiviteten"}
          </Button>
        )}
      </header>

      <div className="mt-6">
        <EventCoaches eventId={eventId} teamId={teamId} userId={userId} canEdit={isCoach} />
      </div>

      <section className="mt-6 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold">
            {event.data?.type === "match" ? "Matchplanering" : "Träningsplanering"}
          </h2>
          <PlanStatusBadge
            status={planStatus({
              type: event.data?.type ?? "training",
              planSaved: !!plan.data,
              resourceCount: (planResources.data ?? []).filter((row) => row.kind !== "tactic")
                .length,
              playerCount: (eventSquad.data ?? []).length,
              coachCount: (planCoaches.data ?? []).length,
            })}
          />
        </div>
        {event.data?.type === "match" ? (
          <>
            <p className="mt-3 text-sm font-semibold">Övrigt</p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {plan.data?.notes?.trim() ? plan.data.notes : "Ingen anteckning."}
            </p>
          </>
        ) : (
          <EventResources eventId={eventId} teamId={teamId} userId={userId} isCoach={isCoach} />
        )}
        <Button variant="outline" size="sm" className="mt-3" asChild>
          {event.data?.type === "match" ? (
            <Link to="/planera-match" search={{ eventId }}>
              Öppna planeringen
            </Link>
          ) : (
            <Link to="/planera-traning" search={{ eventId, mode: "edit" as const }}>
              Öppna planeringen
            </Link>
          )}
        </Button>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl font-bold">Kallelse och deltagare</h2>
          {isCoach && (
            <Button size="sm" onClick={openDialog}>
              {list.length > 0 ? "Hantera kallelse" : "Skapa kallelse"}
            </Button>
          )}
        </div>

        {invites.isError && (
          <div className="mt-3">
            <p className="text-sm text-muted-foreground">Kallelsen kunde inte hämtas just nu.</p>
            <Button size="sm" className="mt-2" onClick={() => invites.refetch()}>
              Försök igen
            </Button>
          </div>
        )}

        {!invites.isLoading && !invites.isError && list.length === 0 && (
          <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            {isCoach
              ? "Ingen kallelse har skapats ännu."
              : "Det finns ingen kallelse till den här aktiviteten."}
          </p>
        )}

        {list.length > 0 && (
          <>
            <p className="mt-3 text-sm font-semibold">{summaryText(counts)}</p>
            {meta?.respond_by && (
              <p className="text-xs text-muted-foreground">Sista svarsdag: {meta.respond_by}</p>
            )}
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <Stat label="Kallade" value={counts.total} />
              <Stat label="Beräknat antal" value={expectedAttendance(counts)} />
              <Stat label="Saknar svar" value={counts.pending} />
              <Stat label="Svarat" value={counts.total - counts.pending} />
            </dl>

            {meta?.message && (
              <p className="mt-3 rounded-xl border border-border bg-card p-3 text-sm">
                {meta.message}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <FilterButton active={filter === "alla"} onClick={() => setFilter("alla")}>
                Alla ({counts.total})
              </FilterButton>
              {INVITE_STATUSES.map((status) => (
                <FilterButton
                  key={status}
                  active={filter === status}
                  onClick={() => setFilter(status)}
                >
                  {inviteStatusLabel(status)} ({counts[status]})
                </FilterButton>
              ))}
            </div>

            {isCoach && counts.pending > 0 && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                disabled={remind.isPending}
                onClick={() => remind.mutate()}
              >
                <Bell className="size-4" /> Påminn obesvarade ({counts.pending})
              </Button>
            )}
            {isCoach && (
              <p className="mt-2 text-xs text-muted-foreground">
                {lastReminder
                  ? `Senaste påminnelsen skickades ${formatDateTime(lastReminder)}. `
                  : "Ingen påminnelse har skickats ännu. "}
                {EXTERNAL_CHANNELS_TEXT}
              </p>
            )}

            <ul className="mt-4 space-y-2">
              {filtered.map((invitation) => {
                const mine = canRespondSelf(invitation, userId);
                const guardianOf = canRespondAsGuardian(invitation, guardedIds);
                const mayAnswer = (isCoach || mine || guardianOf) && !cancelled;
                const open = openRow === invitation.id;
                return (
                  <li key={invitation.id} className="rounded-xl border border-border bg-card">
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-center justify-between gap-2 p-3 text-left"
                      onClick={() => setOpenRow(open ? null : invitation.id)}
                      aria-expanded={open}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {invitation.playerName}
                          {invitation.playerActive === false && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              Inaktiv
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {inviteStatusLabel(invitation.status)}
                          {invitation.responded_at
                            ? ` · ${formatDateTime(invitation.responded_at)}`
                            : ""}
                          {invitation.respondedByName ? ` · av ${invitation.respondedByName}` : ""}
                        </p>
                        {invitation.comment && (
                          <p className="mt-1 truncate text-xs italic text-muted-foreground">
                            ”{invitation.comment}”
                          </p>
                        )}
                      </div>
                      <Users className="size-4 shrink-0 text-muted-foreground" />
                    </button>

                    <div className="px-3 pb-3">
                      {mayAnswer ? (
                        <div className="grid grid-cols-3 gap-2">
                          {(["attending", "maybe", "declined"] as InviteStatus[]).map((status) => (
                            <Button
                              key={status}
                              size="sm"
                              className="h-12 text-sm"
                              variant={invitation.status === status ? "default" : "secondary"}
                              disabled={respond.isPending}
                              onClick={() => respond.mutate({ invitation, status })}
                            >
                              {inviteStatusLabel(status)}
                            </Button>
                          ))}
                        </div>
                      ) : (
                        !invitation.memberUserId &&
                        isCoach === false && (
                          <p className="text-xs text-muted-foreground">{NO_ACCOUNT_TEXT}</p>
                        )
                      )}

                      {isCoach && !invitation.memberUserId && (
                        <p className="mt-2 text-xs text-muted-foreground">{NO_ACCOUNT_TEXT}</p>
                      )}
                      {cancelled && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Aktiviteten är inställd. Nya svar är stängda.
                        </p>
                      )}
                      {open && <InvitationHistory invitationId={invitation.id} />}
                    </div>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="text-sm text-muted-foreground">Inga spelare i den här gruppen.</li>
              )}
            </ul>
          </>
        )}
      </section>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{list.length > 0 ? "Hantera kallelse" : "Skapa kallelse"}</DialogTitle>
          </DialogHeader>

          <label className="text-sm">
            Sista svarsdag
            <Input
              type="date"
              value={respondBy}
              onChange={(e) => setRespondByValue(e.target.value)}
            />
            {list.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                disabled={saveRespondBy.isPending}
                onClick={() => saveRespondBy.mutate()}
              >
                Spara sista svarsdag
              </Button>
            )}
          </label>

          <label className="text-sm">
            Information till spelarna
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Till exempel samling, utrustning eller resa."
            />
          </label>

          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Spelare</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const invited = new Set(list.map((item) => item.player_id));
                const all = (players.data ?? []).map((p) => p.id).filter((id) => !invited.has(id));
                setSelected(selected.length === all.length ? [] : all);
              }}
            >
              {selected.length > 0 &&
              selected.length ===
                (players.data ?? []).filter((p) => !list.some((item) => item.player_id === p.id))
                  .length
                ? "Avmarkera alla"
                : "Välj alla"}
            </Button>
          </div>

          <ul className="space-y-1">
            {(players.data ?? []).map((player) => {
              const already = list.some((item) => item.player_id === player.id);
              return (
                <li key={player.id}>
                  <label className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm">
                    <input
                      type="checkbox"
                      className="size-5"
                      disabled={already}
                      checked={already || selected.includes(player.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked
                            ? [...prev, player.id]
                            : prev.filter((id) => id !== player.id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1 truncate">{player.name}</span>
                    {already && <span className="text-xs text-muted-foreground">Redan kallad</span>}
                  </label>
                </li>
              );
            })}
            {(players.data ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">Laget har inga spelare ännu.</li>
            )}
          </ul>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              Avbryt
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              Spara kallelse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function InvitationHistory({ invitationId }: { invitationId: string }) {
  const log = useQuery({
    queryKey: ["invitation-log", invitationId],
    queryFn: () => fetchInvitationLog(invitationId),
  });
  const rows = log.data ?? [];
  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-xs font-semibold">Historik</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Inga ändringar ännu.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
          {rows.map((row) => (
            <li key={row.id}>
              {inviteStatusLabel(row.from_status)} → {inviteStatusLabel(row.to_status)} ·{" "}
              {row.changedByName ?? "Okänd"} ({row.changed_role}) · {formatDateTime(row.created_at)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button size="sm" variant={active ? "default" : "ghost"} onClick={onClick}>
      {children}
    </Button>
  );
}
