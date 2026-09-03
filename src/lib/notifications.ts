import { supabase } from "@/integrations/supabase/client";

/** Notisslag som appen kan skapa. */
export const NOTIFICATION_KINDS = [
  "invite_reminder",
  "event_changed",
  "event_cancelled",
  "announcement",
  "membership_approved",
  "membership_request",
  "scheduled_failed",
  "attendance_missing",
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const KIND_LABELS: Record<NotificationKind, string> = {
  invite_reminder: "Kallelsepåminnelse",
  event_changed: "Ändrad aktivitet",
  event_cancelled: "Inställd aktivitet",
  announcement: "Viktigt meddelande",
  membership_approved: "Medlemskap godkänt",
  membership_request: "Ny medlemsansökan",
  scheduled_failed: "Schemalagt meddelande misslyckades",
  attendance_missing: "Närvaro behöver kompletteras",
};

export const KIND_HINTS: Record<NotificationKind, string> = {
  invite_reminder: "Påminnelse när du inte svarat på en kallelse.",
  event_changed: "Tid, plats eller samling har ändrats.",
  event_cancelled: "Aktiviteten är inställd.",
  announcement: "Meddelanden som ledarna markerat som viktiga.",
  membership_approved: "Du har blivit godkänd i ett lag.",
  membership_request: "Någon vill gå med i ditt lag.",
  scheduled_failed: "Ett schemalagt meddelande kunde inte skickas.",
  attendance_missing: "Närvaro saknas efter ett genomfört pass.",
};

/** Viktiga slag levereras direkt och kan inte sättas till daglig sammanfattning. */
export const IMPORTANT_KINDS: NotificationKind[] = [
  "event_changed",
  "event_cancelled",
  "announcement",
];

export type Digest = "instant" | "daily";

export type NotificationPreference = {
  kind: NotificationKind;
  in_app: boolean;
  push: boolean;
  email: boolean;
  digest: Digest;
};

export type NotificationSettings = {
  quiet_enabled: boolean;
  quiet_start: string;
  quiet_end: string;
  time_zone: string;
  important_bypass_quiet: boolean;
  push_enabled: boolean;
};

export const DEFAULT_SETTINGS: NotificationSettings = {
  quiet_enabled: true,
  quiet_start: "21:00",
  quiet_end: "07:00",
  time_zone: "Europe/Stockholm",
  important_bypass_quiet: false,
  push_enabled: false,
};

/** Standard: intern notis på, push av, e-post av, viktigt direkt. */
export function defaultPreference(kind: NotificationKind): NotificationPreference {
  return {
    kind,
    in_app: true,
    push: false,
    email: false,
    digest: IMPORTANT_KINDS.includes(kind) ? "instant" : "daily",
  };
}

export function defaultPreferences(): NotificationPreference[] {
  return NOTIFICATION_KINDS.map(defaultPreference);
}

export function mergePreferences(
  rows: Partial<NotificationPreference>[] | null | undefined,
): NotificationPreference[] {
  const byKind = new Map<string, Partial<NotificationPreference>>();
  for (const row of rows ?? []) if (row?.kind) byKind.set(row.kind, row);
  return NOTIFICATION_KINDS.map((kind) => ({ ...defaultPreference(kind), ...byKind.get(kind) }));
}

/** Minuter sedan midnatt för "HH:mm". */
export function minutesOfDay(value: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return 0;
  const hours = Math.min(23, Number(match[1]));
  const minutes = Math.min(59, Number(match[2]));
  return hours * 60 + minutes;
}

/** Lokal klockslagstid (minuter) i angiven tidszon – hanterar sommar-/vintertid. */
export function localMinutes(at: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return (hour % 24) * 60 + minute;
}

/** Är tidpunkten inom tyst tid? Perioden får passera midnatt. */
export function isQuietTime(at: Date, settings: NotificationSettings): boolean {
  if (!settings.quiet_enabled) return false;
  const now = localMinutes(at, settings.time_zone);
  const start = minutesOfDay(settings.quiet_start);
  const end = minutesOfDay(settings.quiet_end);
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

export type DeliveryPlan = {
  inApp: boolean;
  push: boolean;
  email: boolean;
  /** "now" = direkt, "digest" = med dagens sammanfattning, "quiet" = håll tillbaka tills tyst tid är slut. */
  timing: "now" | "digest" | "quiet";
};

/** Avgör hur en notis ska levereras enligt användarens val. */
export function planDelivery(
  kind: NotificationKind,
  preference: NotificationPreference,
  settings: NotificationSettings,
  at: Date,
): DeliveryPlan {
  const important = IMPORTANT_KINDS.includes(kind);
  const quiet = isQuietTime(at, settings);
  const push = preference.push && settings.push_enabled;
  let timing: DeliveryPlan["timing"] = "now";
  if (!important && preference.digest === "daily") timing = "digest";
  if (quiet) {
    if (important && settings.important_bypass_quiet) timing = "now";
    else timing = timing === "digest" ? "digest" : "quiet";
  }
  return { inApp: preference.in_app, push, email: preference.email, timing };
}

/** Stabil nyckel så att samma händelse inte skapar dubbletter. */
export function dedupeKey(parts: (string | null | undefined)[]): string {
  return parts
    .map((part) => (part ?? "").toString().trim().toLowerCase())
    .filter(Boolean)
    .join(":");
}

export async function fetchNotificationConfig(userId: string) {
  const [prefs, settings] = await Promise.all([
    supabase.from("notification_preferences").select("*").eq("user_id", userId),
    supabase.from("notification_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  if (prefs.error) throw prefs.error;
  if (settings.error) throw settings.error;
  return {
    preferences: mergePreferences(prefs.data as Partial<NotificationPreference>[] | null),
    settings: { ...DEFAULT_SETTINGS, ...(settings.data ?? {}) } as NotificationSettings,
  };
}

export async function saveNotificationPreference(
  userId: string,
  preference: NotificationPreference,
) {
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, ...preference }, { onConflict: "user_id,kind" });
  if (error) throw error;
}

export async function saveNotificationSettings(
  userId: string,
  settings: Partial<NotificationSettings>,
) {
  const { error } = await supabase
    .from("notification_settings")
    .upsert({ user_id: userId, ...settings }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function registerPushDevice(userId: string, endpoint: string, label: string) {
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      { user_id: userId, endpoint, device_label: label, last_used_at: new Date().toISOString() },
      { onConflict: "user_id,endpoint" },
    );
  if (error) throw error;
}

export async function revokePushDevices(userId: string) {
  const { error } = await supabase
    .from("push_subscriptions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (error) throw error;
}
