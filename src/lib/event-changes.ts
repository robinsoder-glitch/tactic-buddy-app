import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/teams";

/** Fält som medlemmarna behöver få veta om de ändras. */
export type EventChangeField = "starts_at" | "ends_at" | "meet_at" | "location" | "cancelled_at";

export type EventChange = {
  field: EventChangeField;
  label: string;
  from: string;
  to: string;
};

export const CHANGE_LABELS: Record<EventChangeField, string> = {
  starts_at: "Starttid",
  ends_at: "Sluttid",
  meet_at: "Samlingstid",
  location: "Plats",
  cancelled_at: "Status",
};

type EventLike = Partial<Record<EventChangeField, string | null | undefined>>;

function display(field: EventChangeField, value: string | null | undefined): string {
  if (field === "cancelled_at") return value ? "Inställd" : "Aktiv";
  if (!value) return "Saknas";
  if (field === "location") return value;
  return formatDateTime(value);
}

/** Jämför gammal och ny aktivitet och returnerar bara faktiska ändringar. */
export function diffEvent(before: EventLike, after: EventLike): EventChange[] {
  const fields: EventChangeField[] = [
    "starts_at",
    "ends_at",
    "meet_at",
    "location",
    "cancelled_at",
  ];
  const changes: EventChange[] = [];
  for (const field of fields) {
    if (!(field in after)) continue;
    const from = display(field, before[field]);
    const to = display(field, after[field]);
    if (from === to) continue;
    changes.push({ field, label: CHANGE_LABELS[field], from, to });
  }
  return changes;
}

/** Begriplig text till medlemmarna, exempelvis "Tiden har ändrats från … till …". */
export function changeNotice(changes: EventChange[]): string {
  if (changes.length === 0) return "";
  return changes
    .map((change) => {
      if (change.field === "cancelled_at") {
        return change.to === "Inställd"
          ? "Aktiviteten är inställd."
          : "Aktiviteten är inte längre inställd.";
      }
      return `${change.label} har ändrats från ${change.from} till ${change.to}.`;
    })
    .join(" ");
}

/** Kvitto till tränaren om vad som faktiskt sparades. */
export function changeReceipt(changes: EventChange[]): string {
  if (changes.length === 0) return "Inget ändrades.";
  return `Sparat. ${changeNotice(changes)}`;
}

export async function logEventChange(eventId: string, changes: EventChange[]) {
  if (changes.length === 0) return;
  const { error } = await supabase.rpc("log_event_change", {
    _event_id: eventId,
    _changed_fields: changes as unknown as never,
    _notice: changeNotice(changes),
  });
  if (error) throw error;
}

export type EventChangeLogRow = {
  id: string;
  created_at: string;
  changed_by: string | null;
  changed_fields: EventChange[];
};

export async function fetchEventChangeLog(eventId: string): Promise<EventChangeLogRow[]> {
  const { data, error } = await supabase
    .from("event_change_log")
    .select("id, created_at, changed_by, changed_fields")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as unknown as EventChangeLogRow[];
}
