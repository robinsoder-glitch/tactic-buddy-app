import { supabase } from "@/integrations/supabase/client";
import type { TrainingSessionCard } from "./taktikbank";

/** Typer av delar som kan ingå i ett personligt träningspass. */
export const ITEM_KINDS = [
  "tactic",
  "drill",
  "goalkeeper",
  "article",
  "gathering",
  "break",
  "custom",
] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

export const ITEM_KIND_LABELS: Record<ItemKind, string> = {
  tactic: "Taktik",
  drill: "Övning",
  goalkeeper: "Målvaktsövning",
  article: "Kunskapsartikel",
  gathering: "Samling eller genomgång",
  break: "Paus",
  custom: "Egen aktivitet",
};

/** Delar som hämtar innehåll från en bank. */
export const BANK_KINDS: ItemKind[] = ["tactic", "drill", "goalkeeper", "article"];

export const SESSION_STATUS_LABELS: Record<string, string> = {
  draft: "Utkast",
  done: "Genomfört",
};

export type CoachSession = {
  id: string;
  title: string;
  session_date: string | null;
  age_group: string | null;
  game_format: string | null;
  theme: string | null;
  goal: string | null;
  notes: string | null;
  status: string;
  template_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CoachSessionItem = {
  id: string;
  session_id: string;
  kind: string;
  title: string;
  resource_id: string | null;
  minutes: number;
  note: string | null;
  sort_order: number;
};

export type SessionDraft = {
  title: string;
  session_date: string | null;
  age_group: string | null;
  game_format: string | null;
  theme: string | null;
  goal: string | null;
  notes: string | null;
};

export const emptyDraft: SessionDraft = {
  title: "",
  session_date: null,
  age_group: null,
  game_format: null,
  theme: null,
  goal: null,
  notes: null,
};

const SESSION_COLUMNS =
  "id, title, session_date, age_group, game_format, theme, goal, notes, status, template_id, created_at, updated_at";
const ITEM_COLUMNS = "id, session_id, kind, title, resource_id, minutes, note, sort_order";

export async function fetchCoachSessions(): Promise<CoachSession[]> {
  const { data, error } = await supabase
    .from("coach_sessions")
    .select(SESSION_COLUMNS)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as CoachSession[];
}

export async function fetchCoachSession(id: string): Promise<CoachSession | null> {
  const { data, error } = await supabase.from("coach_sessions").select(SESSION_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as CoachSession | null;
}

export async function fetchSessionItems(sessionId: string): Promise<CoachSessionItem[]> {
  const { data, error } = await supabase
    .from("coach_session_items")
    .select(ITEM_COLUMNS)
    .eq("session_id", sessionId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as CoachSessionItem[];
}

export async function fetchAllSessionItems(): Promise<CoachSessionItem[]> {
  const { data, error } = await supabase.from("coach_session_items").select(ITEM_COLUMNS).order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as CoachSessionItem[];
}

/** Skapar ett nytt personligt träningspass. Ägaren sätts av databasen. */
export async function createCoachSession(
  draft: SessionDraft,
  userId: string,
  extra: { template_id?: string | null } = {},
): Promise<string> {
  const { data, error } = await supabase
    .from("coach_sessions")
    .insert({
      user_id: userId,
      title: draft.title.trim(),
      session_date: draft.session_date,
      age_group: draft.age_group,
      game_format: draft.game_format,
      theme: draft.theme,
      goal: draft.goal,
      notes: draft.notes,
      status: "draft",
      template_id: extra.template_id ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateCoachSession(id: string, patch: Partial<SessionDraft> & { status?: string }) {
  const { error } = await supabase.from("coach_sessions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCoachSession(id: string) {
  const { error } = await supabase.from("coach_sessions").delete().eq("id", id);
  if (error) throw error;
}

export type NewItem = {
  kind: ItemKind;
  title: string;
  resource_id?: string | null;
  minutes?: number;
  note?: string | null;
};

export async function addSessionItem(sessionId: string, userId: string, item: NewItem) {
  const existing = await fetchSessionItems(sessionId);
  const { error } = await supabase.from("coach_session_items").insert({
    session_id: sessionId,
    user_id: userId,
    kind: item.kind,
    title: item.title.trim(),
    resource_id: item.resource_id ?? null,
    minutes: Math.max(0, Math.round(item.minutes ?? 10)),
    note: item.note ?? null,
    sort_order: nextSortOrder(existing),
  });
  if (error) throw error;
}

export async function updateSessionItem(
  id: string,
  patch: { title?: string; minutes?: number; note?: string | null; sort_order?: number },
) {
  const { error } = await supabase.from("coach_session_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSessionItem(id: string) {
  const { error } = await supabase.from("coach_session_items").delete().eq("id", id);
  if (error) throw error;
}

/** Sparar ny ordning för samtliga delar. */
export async function saveItemOrder(items: CoachSessionItem[]) {
  for (const [index, item] of items.entries()) {
    if (item.sort_order === index) continue;
    const { error } = await supabase.from("coach_session_items").update({ sort_order: index }).eq("id", item.id);
    if (error) throw error;
  }
}

/** Nästa lediga plats i ordningen. */
export function nextSortOrder(items: { sort_order: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.sort_order + 1), 0);
}

/** Flyttar en del uppåt eller nedåt och numrerar om ordningen. */
export function moveItem<T extends { sort_order: number }>(items: T[], index: number, direction: -1 | 1): T[] {
  const list = [...items];
  const target = index + direction;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return items;
  const a = list[index]!;
  const b = list[target]!;
  list[index] = b;
  list[target] = a;
  return list.map((item, position) => ({ ...item, sort_order: position }));
}

/** Total planerad tid i minuter. */
export function totalMinutes(items: { minutes: number }[]): number {
  return items.reduce((sum, item) => sum + (Number.isFinite(item.minutes) ? item.minutes : 0), 0);
}

export function minutesLabel(minutes: number): string {
  return `Total träningstid: ${minutes} minuter`;
}

/** Titel för en kopia. */
export function copyTitle(title: string): string {
  return `Kopia av ${title}`.slice(0, 200);
}

/** Delar från en redaktionell mall, utan att originalet ändras. */
export function templateItems(template: TrainingSessionCard): NewItem[] {
  const blocks = [...(template.data.blocks ?? [])].sort((a, b) => a.order - b.order);
  return blocks.map((block) => ({
    kind: (block.drillId ? "drill" : "custom") as ItemKind,
    title: block.activity,
    resource_id: block.drillId ?? null,
    minutes: block.minutes ?? 10,
    note: null,
  }));
}

/** Kopierar en redaktionell mall till ett nytt personligt träningspass. */
export async function createFromTemplate(template: TrainingSessionCard, userId: string): Promise<string> {
  const sessionId = await createCoachSession(
    {
      ...emptyDraft,
      title: template.title,
      theme: template.data.theme ?? template.theme ?? null,
      goal: template.data.coachLimit ?? null,
    },
    userId,
    { template_id: template.id },
  );
  const items = templateItems(template);
  if (items.length) {
    const { error } = await supabase.from("coach_session_items").insert(
      items.map((item, index) => ({
        session_id: sessionId,
        user_id: userId,
        kind: item.kind,
        title: item.title,
        resource_id: item.resource_id ?? null,
        minutes: item.minutes ?? 10,
        note: item.note ?? null,
        sort_order: index,
      })),
    );
    if (error) throw error;
  }
  return sessionId;
}

/** Duplicerar ett personligt träningspass med alla delar. */
export async function duplicateCoachSession(session: CoachSession, userId: string): Promise<string> {
  const items = await fetchSessionItems(session.id);
  const newId = await createCoachSession(
    {
      title: copyTitle(session.title),
      session_date: session.session_date,
      age_group: session.age_group,
      game_format: session.game_format,
      theme: session.theme,
      goal: session.goal,
      notes: session.notes,
    },
    userId,
    { template_id: session.template_id },
  );
  if (items.length) {
    const { error } = await supabase.from("coach_session_items").insert(
      items.map((item, index) => ({
        session_id: newId,
        user_id: userId,
        kind: item.kind,
        title: item.title,
        resource_id: item.resource_id,
        minutes: item.minutes,
        note: item.note,
        sort_order: index,
      })),
    );
    if (error) throw error;
  }
  return newId;
}

/** Kort svensk beskrivning av ett fel, aldrig rå teknisk text. */
export function friendlyError(fallback = "Något gick fel. Försök igen."): string {
  return fallback;
}
