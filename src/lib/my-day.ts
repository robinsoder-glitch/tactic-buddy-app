/**
 * Etapp 4 – Min dag.
 * Startsidan hämtar allt i ett anrop (get_my_day_summary) och sorteringen
 * görs redan i databasen. Här finns typer, etiketter och hjälpfunktioner
 * som går att testa utan databas.
 */
import { supabase } from "@/integrations/supabase/client";

export type TodoKind =
  | "event_cancelled"
  | "event_changed"
  | "invite_unanswered"
  | "announcement_unread"
  | "pending_join"
  | "session_run"
  | "planning_missing"
  | "attendance_missing";

export type TodoItem = {
  kind: TodoKind;
  priority: number;
  team_id: string | null;
  team_name: string | null;
  event_id: string | null;
  player_id: string | null;
  player_name: string | null;
  title: string;
  subtitle: string | null;
  due_at: string | null;
  action_url: string;
  action_label: string;
};

export type NextEvent = {
  event_id: string;
  team_id: string;
  team_name: string;
  type: string;
  title: string;
  starts_at: string;
  meet_at: string | null;
  location: string | null;
  action_url: string;
};

export type NewsItem = {
  kind: string;
  title: string;
  body: string | null;
  created_at: string;
  team_id: string | null;
  event_id: string | null;
  read_at: string | null;
};

export type MyDay = { todo: TodoItem[]; next: NextEvent[]; news: NewsItem[] };

export const EMPTY_DAY: MyDay = { todo: [], next: [], news: [] };

/** Hur många kort som visas innan "Visa alla". */
export const TODO_PREVIEW = 5;

export async function fetchMyDay(): Promise<MyDay> {
  const { data, error } = await supabase.rpc("get_my_day_summary");
  if (error) throw new Error(error.message);
  const value = (data ?? {}) as Partial<MyDay>;
  return {
    todo: value.todo ?? [],
    next: value.next ?? [],
    news: value.news ?? [],
  };
}

/** Kort som bara hör hemma hos en ledare. */
const COACH_ONLY: TodoKind[] = [
  "pending_join",
  "planning_missing",
  "attendance_missing",
  "session_run",
];

export function isCoachTodo(kind: TodoKind): boolean {
  return COACH_ONLY.includes(kind);
}

/** Filtrerar på valt lag eller barn. "all" visar allt. */
export function filterTodo(items: TodoItem[], context: string): TodoItem[] {
  if (context === "all") return items;
  if (context.startsWith("team:")) {
    const teamId = context.slice(5);
    return items.filter((item) => item.team_id === teamId);
  }
  if (context.startsWith("player:")) {
    const playerId = context.slice(7);
    return items.filter((item) => item.player_id === playerId);
  }
  if (context === "coach") return items.filter((item) => isCoachTodo(item.kind));
  return items;
}

export function sortTodo(items: TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const at = a.due_at ? Date.parse(a.due_at) : Number.MAX_SAFE_INTEGER;
    const bt = b.due_at ? Date.parse(b.due_at) : Number.MAX_SAFE_INTEGER;
    return at - bt;
  });
}

export function greetingName(displayName: string | null | undefined): string {
  const name = (displayName ?? "").trim();
  if (!name || name.includes("@")) return "Hej!";
  return `Hej ${name.split(" ")[0]}`;
}

/** Positiv text när inget behöver göras. */
export function allDoneText(next: NextEvent[]): string {
  if (!next.length) return "Allt är klart just nu. Inga aktiviteter är inplanerade.";
  return `Allt är klart just nu. Nästa aktivitet är ${nextLabel(next[0])}.`;
}

export function nextLabel(event: NextEvent): string {
  const kind = event.type === "match" ? "match" : event.type === "other" ? "aktivitet" : "träning";
  return `${kind} ${formatWhen(event.starts_at)}`;
}

const DAYS = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];

export function formatWhen(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  });
  const days = Math.round(
    (new Date(date.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / 86400000,
  );
  if (days === 0) return `i dag ${time}`;
  if (days === 1) return `i morgon ${time}`;
  if (days > 1 && days < 7) return `${DAYS[date.getDay()]} ${time}`;
  return `${date.toLocaleDateString("sv-SE", { day: "numeric", month: "short", timeZone: "Europe/Stockholm" })} ${time}`;
}

export function todoBadge(kind: TodoKind): string {
  switch (kind) {
    case "event_cancelled":
      return "Inställd";
    case "event_changed":
      return "Ändrad";
    case "invite_unanswered":
      return "Kallelse";
    case "announcement_unread":
      return "Meddelande";
    case "pending_join":
      return "Ansökan";
    case "session_run":
      return "Pågår";
    case "planning_missing":
      return "Planering";
    case "attendance_missing":
      return "Närvaro";
    default:
      return "Att göra";
  }
}

export function newsLabel(kind: string): string {
  switch (kind) {
    case "announcement":
      return "Viktigt meddelande";
    case "announcement_reminder":
      return "Påminnelse";
    case "event_changed":
      return "Ändrad aktivitet";
    case "invite_reminder":
      return "Påminnelse om kallelse";
    case "membership_approved":
      return "Medlemskap";
    default:
      return "Nyhet";
  }
}
