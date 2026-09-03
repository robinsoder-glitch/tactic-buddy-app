import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Inbox, Megaphone, MessagesSquare, Send } from "lucide-react";
import { toast } from "sonner";
import {
  AUDIENCE_OPTIONS,
  audienceLabel,
  audienceNeedsEvent,
  canRemind,
  cancelAnnouncement,
  countUnreadInbox,
  createAnnouncement,
  fetchAnnouncementReaders,
  fetchInbox,
  fetchRecentEventMessages,
  fetchTeamAnnouncements,
  markAnnouncementRead,
  messageTime,
  previewAudience,
  priorityLabel,
  readSummary,
  remindUnread,
  sortInbox,
  statusLabel,
  validateDraft,
  type AudienceType,
} from "@/lib/announcements";
import { fetchEvents } from "@/lib/teams";
import { useAccount } from "@/hooks/useAccount";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/meddelanden")({
  component: MessagesPage,
  head: () => ({
    meta: [
      { title: "Meddelanden – Fotbollsrummet" },
      {
        name: "description",
        content:
          "Viktiga meddelanden från laget, frågor om aktiviteter och tydlig lässtatus för tränaren.",
      },
      { property: "og:title", content: "Meddelanden – Fotbollsrummet" },
      {
        property: "og:description",
        content: "Läs viktiga meddelanden från laget och håll koll på aktiviteternas frågor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const LEADER_ROLES = ["coach", "head_coach", "club_admin"];

function MessagesPage() {
  const { memberships, userId } = useAccount();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"inbox" | "activities" | "sent">("inbox");
  const [unreadFirst, setUnreadFirst] = useState(true);
  const [teamFilter, setTeamFilter] = useState<string>("all");

  const coachTeams = memberships.filter(
    (item) => item.status === "approved" && LEADER_ROLES.includes(item.role),
  );

  const inbox = useQuery({
    queryKey: ["announcement-inbox", userId],
    queryFn: fetchInbox,
    enabled: !!userId,
  });

  const items = useMemo(() => {
    const list = (inbox.data ?? []).filter(
      (item) => teamFilter === "all" || item.team_id === teamFilter,
    );
    return sortInbox(list, unreadFirst);
  }, [inbox.data, teamFilter, unreadFirst]);

  const markRead = useMutation({
    mutationFn: (id: string) => markAnnouncementRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["announcement-inbox"] });
      queryClient.invalidateQueries({ queryKey: ["announcement-unread"] });
    },
  });

  const unread = countUnreadInbox(inbox.data ?? []);

  const myTeamIds = useMemo(
    () => memberships.filter((m) => m.status === "approved").map((m) => m.team_id),
    [memberships],
  );
  const activityMessages = useQuery({
    queryKey: ["event-messages-recent", myTeamIds],
    queryFn: () => fetchRecentEventMessages(myTeamIds),
    enabled: tab === "activities" && myTeamIds.length > 0,
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Meddelanden</h1>
        <p className="text-sm text-muted-foreground">
          Viktig information från laget. Frågor om en enskild träning eller match ställer du på
          aktivitetens sida.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Meddelanden">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "inbox"}
          onClick={() => setTab("inbox")}
          className={`min-h-[44px] rounded-lg border px-4 text-sm font-semibold ${tab === "inbox" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
        >
          <Inbox className="mr-2 inline size-4" aria-hidden />
          Viktigt {unread > 0 ? `(${unread} olästa)` : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "activities"}
          onClick={() => setTab("activities")}
          className={`min-h-[44px] rounded-lg border px-4 text-sm font-semibold ${tab === "activities" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
        >
          <MessagesSquare className="mr-2 inline size-4" aria-hidden />
          Aktiviteter
        </button>
        {coachTeams.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "sent"}
            onClick={() => setTab("sent")}
            className={`min-h-[44px] rounded-lg border px-4 text-sm font-semibold ${tab === "sent" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"}`}
          >
            <Megaphone className="mr-2 inline size-4" aria-hidden />
            Skicka och följ upp
          </button>
        )}
      </div>

      {tab === "activities" && (
        <section className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Senaste frågorna och svaren på lagets aktiviteter.
          </p>
          {activityMessages.isLoading && (
            <p className="text-sm text-muted-foreground">Hämtar frågor …</p>
          )}
          {activityMessages.data?.length === 0 && (
            <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              Inga frågor ännu. Öppna en aktivitet i kalendern för att ställa den första.
            </p>
          )}
          <ul className="space-y-2">
            {(activityMessages.data ?? []).map((message) => (
              <li key={message.id} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  {message.displayName ?? "Medlem"} · {messageTime(message.created_at)}
                </p>
                <p className="mt-1 text-sm">{message.body}</p>
                <Link
                  to="/team/$teamId/event/$eventId"
                  params={{ teamId: message.team_id, eventId: message.event_id }}
                  className="mt-2 inline-block text-sm font-semibold text-primary underline"
                >
                  {message.eventTitle ?? "Öppna aktiviteten"}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tab === "inbox" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold" htmlFor="team-filter">
              Lag
            </label>
            <select
              id="team-filter"
              value={teamFilter}
              onChange={(event) => setTeamFilter(event.target.value)}
              className="min-h-[44px] rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="all">Alla lag</option>
              {memberships.map((item) => (
                <option key={item.team_id} value={item.team_id}>
                  {item.team?.name ?? "Lag"}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={unreadFirst}
                onChange={(event) => setUnreadFirst(event.target.checked)}
              />
              Olästa först
            </label>
          </div>

          {inbox.isLoading && <p className="text-sm text-muted-foreground">Hämtar meddelanden …</p>}
          {!inbox.isLoading && !items.length && (
            <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Du har inga meddelanden just nu.
            </p>
          )}

          {items.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl border p-4 ${item.read_at ? "border-border bg-card" : "border-primary bg-primary/5"}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {!item.read_at && (
                  <span className="rounded-full bg-primary px-2 py-0.5 font-bold text-primary-foreground">
                    Oläst
                  </span>
                )}
                {item.priority === "important" && (
                  <span className="rounded-full bg-destructive px-2 py-0.5 font-bold text-destructive-foreground">
                    Viktigt
                  </span>
                )}
                <span>{item.teamName ?? "Lag"}</span>
                <span>·</span>
                <span>{messageTime(item.published_at)}</span>
                {item.senderName && <span>· {item.senderName}</span>}
              </div>
              <h2 className="mt-2 font-display text-lg font-bold">{item.title}</h2>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                {item.body}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.event_id && (
                  <Link
                    to="/team/$teamId/event/$eventId"
                    params={{ teamId: item.team_id, eventId: item.event_id }}
                    className="inline-flex min-h-[44px] items-center rounded-lg border border-border px-3 text-sm font-semibold"
                  >
                    Öppna aktiviteten
                  </Link>
                )}
                {!item.read_at && (
                  <Button
                    type="button"
                    onClick={() => markRead.mutate(item.id)}
                    disabled={markRead.isPending}
                    className="min-h-[44px]"
                  >
                    <CheckCheck className="mr-2 size-4" aria-hidden />
                    Markera som läst
                  </Button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === "sent" && coachTeams.length > 0 && (
        <CoachMessages
          teams={coachTeams.map((item) => ({
            id: item.team_id,
            name: item.team?.name ?? "Lag",
          }))}
        />
      )}
    </main>
  );
}

function CoachMessages({ teams }: { teams: { id: string; name: string }[] }) {
  const queryClient = useQueryClient();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"normal" | "important">("normal");
  const [audience, setAudience] = useState<AudienceType>("all");
  const [eventId, setEventId] = useState<string>("");
  const [requiresReceipt, setRequiresReceipt] = useState(true);
  const [scheduledFor, setScheduledFor] = useState("");
  const [openReaders, setOpenReaders] = useState<string | null>(null);

  const events = useQuery({
    queryKey: ["team-events", teamId],
    queryFn: () => fetchEvents(teamId),
    enabled: !!teamId,
  });

  const sent = useQuery({
    queryKey: ["team-announcements", teamId],
    queryFn: () => fetchTeamAnnouncements(teamId),
    enabled: !!teamId,
  });

  const preview = useQuery({
    queryKey: ["audience-preview", teamId, audience, eventId],
    queryFn: () => previewAudience(teamId, audience, eventId || null),
    enabled: !!teamId && (!audienceNeedsEvent(audience) || !!eventId),
  });

  const draft = {
    title,
    body,
    teamId: teamId || null,
    audience,
    eventId: eventId || null,
    scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
  };
  const problem = validateDraft(draft);

  const publish = useMutation({
    mutationFn: () =>
      createAnnouncement({
        teamId,
        eventId: eventId || null,
        title,
        body,
        priority,
        audience,
        requiresReadReceipt: requiresReceipt,
        scheduledFor: draft.scheduledFor,
      }),
    onSuccess: (result) => {
      setTitle("");
      setBody("");
      toast.success(
        result.scheduled
          ? "Meddelandet publiceras vid vald tid."
          : `Meddelandet skickades till ${result.recipients} personer.`,
      );
      queryClient.invalidateQueries({ queryKey: ["team-announcements", teamId] });
    },
    onError: (error: Error) => toast.error(error.message || "Kunde inte skicka meddelandet."),
  });

  const remind = useMutation({
    mutationFn: (id: string) => remindUnread(id),
    onSuccess: (result) => {
      toast[result.skipped ? "info" : "success"](
        result.skipped
          ? "En påminnelse skickades nyligen. Vänta en stund innan nästa."
          : `Påminnelse skickad till ${result.sent} personer.`,
      );
      queryClient.invalidateQueries({ queryKey: ["team-announcements", teamId] });
    },
    onError: (error: Error) => toast.error(error.message || "Kunde inte påminna."),
  });

  const cancelScheduled = useMutation({
    mutationFn: (id: string) => cancelAnnouncement(id),
    onSuccess: () => {
      toast.success("Det schemalagda meddelandet är avbrutet.");
      queryClient.invalidateQueries({ queryKey: ["team-announcements", teamId] });
    },
    onError: () => toast.error("Kunde inte avbryta meddelandet."),
  });

  return (
    <section className="space-y-6">
      <form
        className="space-y-4 rounded-xl border border-border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (problem) {
            toast.error(problem);
            return;
          }
          if (!publish.isPending) publish.mutate();
        }}
      >
        <h2 className="font-display text-lg font-bold">Skicka viktigt meddelande</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Lag
            <select
              value={teamId}
              onChange={(event) => setTeamId(event.target.value)}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm font-normal"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold">
            Målgrupp
            <select
              value={audience}
              onChange={(event) => setAudience(event.target.value as AudienceType)}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm font-normal"
            >
              {AUDIENCE_OPTIONS.filter((option) => option.value !== "manual").map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm font-semibold">
          Aktivitet {audienceNeedsEvent(audience) ? "(krävs)" : "(valfritt)"}
          <select
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm font-normal"
          >
            <option value="">Ingen aktivitet</option>
            {(events.data ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} – {messageTime(item.starts_at)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-semibold">
          Rubrik
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Till exempel: Träningen flyttad"
            className="mt-1 min-h-[44px] font-normal"
          />
        </label>

        <label className="block text-sm font-semibold">
          Meddelande
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
            placeholder="Skriv kort och tydligt."
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Prioritet
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value as "normal" | "important")}
              className="mt-1 min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm font-normal"
            >
              <option value="normal">Normal</option>
              <option value="important">Viktig</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Publicera senare (valfritt)
            <Input
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              className="mt-1 min-h-[44px] font-normal"
            />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={requiresReceipt}
            onChange={(event) => setRequiresReceipt(event.target.checked)}
          />
          Be om läskvitto
        </label>

        <div className="rounded-lg bg-secondary p-3 text-sm">
          <p className="font-semibold">Mottagare: {audienceLabel(audience)}</p>
          {preview.data ? (
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              <li>{preview.data.recipients} konton får meddelandet</li>
              <li>{preview.data.coaches} ledare</li>
              <li>{preview.data.players} spelarkonton</li>
              <li>{preview.data.guardians} vårdnadshavare</li>
              <li>
                {preview.data.without_account} spelare saknar kopplat konto och kan inte få någon
                notis i appen
              </li>
            </ul>
          ) : (
            <p className="mt-1 text-muted-foreground">Räknar mottagare …</p>
          )}
        </div>

        <Button type="submit" disabled={!!problem || publish.isPending} className="min-h-[44px]">
          <Send className="mr-2 size-4" aria-hidden />
          {scheduledFor ? "Schemalägg meddelandet" : "Skicka meddelandet"}
        </Button>
        {problem && <p className="text-sm text-destructive">{problem}</p>}
      </form>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Skickade meddelanden</h2>
        {sent.isLoading && <p className="text-sm text-muted-foreground">Hämtar …</p>}
        {!sent.isLoading && !(sent.data ?? []).length && (
          <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Du har inte skickat något meddelande ännu.
          </p>
        )}
        {(sent.data ?? []).map((item) => (
          <article key={item.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-2 py-0.5 font-semibold">
                {statusLabel(item.status)}
              </span>
              <span>{priorityLabel(item.priority)}</span>
              <span>· {audienceLabel(item.audience_type)}</span>
              <span>
                ·{" "}
                {item.status === "scheduled"
                  ? `Publiceras ${messageTime(item.scheduled_for)}`
                  : messageTime(item.published_at)}
              </span>
            </div>
            <h3 className="mt-2 font-semibold">{item.title}</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
              {item.body}
            </p>

            {item.status === "scheduled" && (
              <Button
                type="button"
                variant="outline"
                className="mt-3 min-h-[44px]"
                onClick={() => cancelScheduled.mutate(item.id)}
                disabled={cancelScheduled.isPending}
              >
                Avbryt publiceringen
              </Button>
            )}

            {item.status === "published" && (
              <ReadStatus
                announcementId={item.id}
                withoutAccount={item.without_account_count}
                open={openReaders === item.id}
                onToggle={() => setOpenReaders(openReaders === item.id ? null : item.id)}
                onRemind={() => remind.mutate(item.id)}
                reminding={remind.isPending}
                lastReminderAt={item.last_reminder_at}
              />
            )}
          </article>
        ))}
      </section>
    </section>
  );
}

function ReadStatus({
  announcementId,
  withoutAccount,
  open,
  onToggle,
  onRemind,
  reminding,
  lastReminderAt,
}: {
  announcementId: string;
  withoutAccount: number;
  open: boolean;
  onToggle: () => void;
  onRemind: () => void;
  reminding: boolean;
  lastReminderAt: string | null;
}) {
  const readers = useQuery({
    queryKey: ["announcement-readers", announcementId],
    queryFn: () => fetchAnnouncementReaders(announcementId),
  });

  const summary = readSummary(readers.data ?? [], withoutAccount);
  const allowed = canRemind(lastReminderAt);

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-secondary p-3 text-sm">
      <p>
        Läst: {summary.read} · Inte läst: {summary.unread} · Saknar konto: {summary.withoutAccount}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={onToggle}>
          {open ? "Dölj vilka som inte läst" : "Visa vilka som inte läst"}
        </Button>
        <Button
          type="button"
          className="min-h-[44px]"
          onClick={onRemind}
          disabled={reminding || !allowed || summary.unread === 0}
        >
          <Bell className="mr-2 size-4" aria-hidden />
          Påminn olästa
        </Button>
      </div>
      {lastReminderAt && (
        <p className="text-xs text-muted-foreground">
          Senaste påminnelse: {messageTime(lastReminderAt)}
        </p>
      )}
      {open && (
        <ul className="space-y-1 text-muted-foreground">
          {(readers.data ?? [])
            .filter((row) => !row.read_at)
            .map((row) => (
              <li key={row.user_id}>{row.name ?? "Medlem utan namn"}</li>
            ))}
          {!(readers.data ?? []).some((row) => !row.read_at) && <li>Alla har läst meddelandet.</li>}
        </ul>
      )}
    </div>
  );
}
