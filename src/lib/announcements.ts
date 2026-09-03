/**
 * Etapp 3 – medlemskommunikation.
 * Viktiga meddelanden (envägs, med läskvitto) och aktivitetsdiskussion.
 * Tränarsnack ligger kvar i team-chat.ts.
 */
import { supabase } from "@/integrations/supabase/client";

export type AudienceType =
  | "all"
  | "guardians"
  | "players"
  | "coaches"
  | "event_invited"
  | "event_going"
  | "event_no_reply"
  | "manual";

export type AnnouncementPriority = "normal" | "important";
export type AnnouncementStatus = "draft" | "scheduled" | "published" | "cancelled";

export type Announcement = {
  id: string;
  team_id: string;
  event_id: string | null;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  audience_type: AudienceType;
  requires_read_receipt: boolean;
  status: AnnouncementStatus;
  scheduled_for: string | null;
  published_at: string | null;
  last_reminder_at: string | null;
  recipient_count: number;
  without_account_count: number;
  created_by: string;
  created_at: string;
};

export type InboxItem = Announcement & {
  read_at: string | null;
  teamName: string | null;
  senderName: string | null;
};

export type AudiencePreview = {
  recipients: number;
  coaches: number;
  players: number;
  guardians: number;
  without_account: number;
};

/* ------------------------------ rena hjälpare ------------------------------ */

export const AUDIENCE_OPTIONS: { value: AudienceType; label: string }[] = [
  { value: "all", label: "Alla i laget" },
  { value: "guardians", label: "Alla vårdnadshavare" },
  { value: "players", label: "Alla spelarkonton" },
  { value: "coaches", label: "Alla ledare" },
  { value: "event_invited", label: "Kallade till en aktivitet" },
  { value: "event_going", label: "De som svarat Kommer" },
  { value: "event_no_reply", label: "De som inte har svarat" },
  { value: "manual", label: "Valda mottagare" },
];

export function audienceLabel(value: AudienceType): string {
  return AUDIENCE_OPTIONS.find((option) => option.value === value)?.label ?? "Alla i laget";
}

/** Målgrupper som kräver att en aktivitet väljs. */
export function audienceNeedsEvent(value: AudienceType): boolean {
  return value === "event_invited" || value === "event_going" || value === "event_no_reply";
}

export function priorityLabel(value: AnnouncementPriority): string {
  return value === "important" ? "Viktigt" : "Normal";
}

export function statusLabel(value: AnnouncementStatus): string {
  if (value === "published") return "Publicerat";
  if (value === "scheduled") return "Schemalagt";
  if (value === "cancelled") return "Avbrutet";
  return "Utkast";
}

/** Svensk tidsetikett i Europe/Stockholm. */
export function messageTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("sv-SE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  });
}

export type DraftInput = {
  title: string;
  body: string;
  teamId: string | null;
  audience: AudienceType;
  eventId: string | null;
  scheduledFor: string | null;
};

/** Kontroll före publicering. Returnerar ett svenskt fel eller null. */
export function validateDraft(draft: DraftInput, now: Date = new Date()): string | null {
  if (!draft.teamId) return "Välj vilket lag meddelandet gäller.";
  if (!draft.title.trim()) return "Skriv en rubrik.";
  if (!draft.body.trim()) return "Skriv ett meddelande.";
  if (audienceNeedsEvent(draft.audience) && !draft.eventId)
    return "Välj en aktivitet för den här målgruppen.";
  if (draft.scheduledFor) {
    const when = new Date(draft.scheduledFor);
    if (Number.isNaN(when.getTime())) return "Kontrollera tiden för publicering.";
    if (when.getTime() <= now.getTime()) return "Välj en tid som ligger framåt i tiden.";
  }
  return null;
}

/** Olästa först, därefter nyast först. */
export function sortInbox<T extends { read_at: string | null; published_at: string | null }>(
  items: T[],
  unreadFirst = true,
): T[] {
  return [...items].sort((a, b) => {
    if (unreadFirst) {
      const unreadA = a.read_at ? 1 : 0;
      const unreadB = b.read_at ? 1 : 0;
      if (unreadA !== unreadB) return unreadA - unreadB;
    }
    return (b.published_at ?? "").localeCompare(a.published_at ?? "");
  });
}

export function countUnreadInbox(items: { read_at: string | null }[]): number {
  return items.filter((item) => !item.read_at).length;
}

/** Sammanställer lässtatus för tränaren. */
export function readSummary(
  rows: { read_at: string | null }[],
  withoutAccount: number,
): { read: number; unread: number; withoutAccount: number } {
  return {
    read: rows.filter((row) => row.read_at).length,
    unread: rows.filter((row) => !row.read_at).length,
    withoutAccount,
  };
}

/** Påminnelsen har dubblettskydd i en timme. */
export function canRemind(lastReminderAt: string | null, now: Date = new Date()): boolean {
  if (!lastReminderAt) return true;
  const last = new Date(lastReminderAt).getTime();
  if (Number.isNaN(last)) return true;
  return now.getTime() - last > 60 * 60 * 1000;
}

/** Text som visas i stället för ett borttaget meddelande. */
export const DELETED_MESSAGE_TEXT = "Meddelandet har tagits bort";

/* ------------------------------ databasanrop ------------------------------ */

export async function previewAudience(
  teamId: string,
  audience: AudienceType,
  eventId: string | null,
  manual: string[] = [],
): Promise<AudiencePreview> {
  const { data, error } = await supabase.rpc("preview_announcement_audience", {
    _team_id: teamId,
    _event_id: eventId as string,
    _audience_type: audience,
    _manual: manual,
  });
  if (error) throw new Error(error.message);
  return data as unknown as AudiencePreview;
}

export type CreateAnnouncementInput = {
  teamId: string;
  eventId: string | null;
  title: string;
  body: string;
  priority: AnnouncementPriority;
  audience: AudienceType;
  manual?: string[];
  requiresReadReceipt: boolean;
  scheduledFor: string | null;
};

/** Skapar meddelandet och publicerar direkt om ingen tid valts. */
export async function createAnnouncement(
  input: CreateAnnouncementInput,
): Promise<{ id: string; recipients: number; withoutAccount: number; scheduled: boolean }> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Du måste vara inloggad.");

  const { data, error } = await supabase
    .from("team_announcements")
    .insert({
      team_id: input.teamId,
      event_id: input.eventId,
      title: input.title.trim(),
      body: input.body.trim(),
      priority: input.priority,
      audience_type: input.audience,
      audience_user_ids: input.manual ?? [],
      requires_read_receipt: input.requiresReadReceipt,
      status: input.scheduledFor ? "scheduled" : "draft",
      scheduled_for: input.scheduledFor,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const id = data.id as string;

  if (input.scheduledFor) return { id, recipients: 0, withoutAccount: 0, scheduled: true };

  const published = await publishAnnouncement(id);
  return { id, ...published, scheduled: false };
}

export async function publishAnnouncement(
  id: string,
): Promise<{ recipients: number; withoutAccount: number }> {
  const { data, error } = await supabase.rpc("publish_team_announcement", {
    _announcement_id: id,
  });
  if (error) throw new Error(error.message);
  const result = data as unknown as { recipients: number; without_account: number };
  return { recipients: result?.recipients ?? 0, withoutAccount: result?.without_account ?? 0 };
}

export async function cancelAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from("team_announcements")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "scheduled");
  if (error) throw new Error(error.message);
}

/** Tränarens lista över lagets meddelanden. */
export async function fetchTeamAnnouncements(teamId: string): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from("team_announcements")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as Announcement[];
}

export async function fetchAnnouncementReaders(
  announcementId: string,
): Promise<{ user_id: string; read_at: string | null; name: string | null }[]> {
  const { data, error } = await supabase
    .from("announcement_recipients")
    .select("user_id, read_at")
    .eq("announcement_id", announcementId);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { user_id: string; read_at: string | null }[];
  if (!rows.length) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", [...new Set(rows.map((row) => row.user_id))]);
  const names = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null]),
  );
  return rows.map((row) => ({ ...row, name: names.get(row.user_id) ?? null }));
}

export async function remindUnread(
  announcementId: string,
): Promise<{ sent: number; skipped: boolean }> {
  const { data, error } = await supabase.rpc("remind_unread_announcement", {
    _announcement_id: announcementId,
  });
  if (error) throw new Error(error.message);
  const result = data as unknown as { sent: number; skipped: boolean };
  return { sent: result?.sent ?? 0, skipped: !!result?.skipped };
}

/** Medlemmens inkorg – bara meddelanden man själv fått. */
export async function fetchInbox(): Promise<InboxItem[]> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from("announcement_recipients")
    .select("read_at, announcement_id, team_announcements(*)")
    .eq("user_id", userId)
    .limit(200);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as {
    read_at: string | null;
    team_announcements: Announcement | null;
  }[];
  const items = rows
    .filter((row) => row.team_announcements && row.team_announcements.status === "published")
    .map((row) => ({ ...(row.team_announcements as Announcement), read_at: row.read_at }));

  const teamIds = [...new Set(items.map((item) => item.team_id))];
  const senderIds = [...new Set(items.map((item) => item.created_by))];
  const [teams, profiles] = await Promise.all([
    teamIds.length
      ? supabase.from("teams").select("id, name").in("id", teamIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    senderIds.length
      ? supabase.from("profiles").select("id, display_name").in("id", senderIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
  ]);
  const teamNames = new Map((teams.data ?? []).map((t) => [t.id as string, t.name as string]));
  const senderNames = new Map(
    (profiles.data ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null]),
  );

  return items.map((item) => ({
    ...item,
    teamName: teamNames.get(item.team_id) ?? null,
    senderName: senderNames.get(item.created_by) ?? null,
  }));
}

export async function markAnnouncementRead(id: string): Promise<void> {
  const { error } = await supabase.rpc("mark_announcement_read", { _announcement_id: id });
  if (error) throw new Error(error.message);
}

/* --------------------------- aktivitetsdiskussion --------------------------- */

export type EventMessage = {
  id: string;
  event_id: string;
  team_id: string;
  user_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  displayName: string | null;
};

export async function fetchEventMessages(eventId: string): Promise<EventMessage[]> {
  const { data, error } = await supabase
    .from("event_messages")
    .select("id, event_id, team_id, user_id, body, created_at, deleted_at")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(300);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<EventMessage, "displayName">[];
  if (!rows.length) return [];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", [...new Set(rows.map((row) => row.user_id))]);
  const names = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null]),
  );
  return rows.map((row) => ({
    ...row,
    body: row.deleted_at ? "" : row.body,
    displayName: names.get(row.user_id) ?? null,
  }));
}

export async function sendEventMessage(
  eventId: string,
  teamId: string,
  body: string,
): Promise<void> {
  const text = body.trim();
  if (!text) throw new Error("Skriv ett meddelande först.");
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Du måste vara inloggad.");
  const { error } = await supabase
    .from("event_messages")
    .insert({ event_id: eventId, team_id: teamId, user_id: userId, body: text });
  if (error) throw new Error(error.message);
}

/** Mjuk borttagning: texten lämnar aldrig databasen till klienten. */
export async function deleteEventMessage(id: string): Promise<void> {
  const { error } = await supabase
    .from("event_messages")
    .update({ body: "", deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export type ActivityMessage = EventMessage & {
  eventTitle: string | null;
  eventStart: string | null;
};

/** Senaste frågorna i alla lag användaren tillhör – till fliken Aktiviteter. */
export async function fetchRecentEventMessages(teamIds: string[]): Promise<ActivityMessage[]> {
  if (!teamIds.length) return [];
  const { data, error } = await supabase
    .from("event_messages")
    .select("id, event_id, team_id, user_id, body, created_at, deleted_at")
    .in("team_id", teamIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<EventMessage, "displayName">[];
  if (!rows.length) return [];
  const [{ data: profiles }, { data: events }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", [...new Set(rows.map((row) => row.user_id))]),
    supabase
      .from("events")
      .select("id, title, type, starts_at")
      .in("id", [...new Set(rows.map((row) => row.event_id))]),
  ]);
  const names = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null]),
  );
  const eventMap = new Map(
    (events ?? []).map((e) => [
      e.id as string,
      {
        title: (e.title as string | null) ?? (e.type as string | null) ?? null,
        start: (e.starts_at as string | null) ?? null,
      },
    ]),
  );
  return rows.map((row) => ({
    ...row,
    displayName: names.get(row.user_id) ?? null,
    eventTitle: eventMap.get(row.event_id)?.title ?? null,
    eventStart: eventMap.get(row.event_id)?.start ?? null,
  }));
}
