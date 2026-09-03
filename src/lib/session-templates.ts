/**
 * Etapp 7 – träningsmallar och kopiering.
 * Bygger vidare på coach_sessions i stället för ett nytt passystem.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CoachSession, CoachSessionItem } from "./coach-sessions";

export type Visibility = "private" | "team";

export const VISIBILITY_LABELS: Record<Visibility, string> = {
  private: "Privat mall",
  team: "Lagmall",
};

export type TemplateCard = {
  id: string;
  title: string;
  minutes: number;
  ageGroup: string | null;
  gameFormat: string | null;
  theme: string | null;
  itemCount: number;
  visibility: Visibility;
  visibilityLabel: string;
  updatedAt: string;
  ownerId: string;
  teamId: string | null;
};

export function sessionVisibility(session: CoachSession): Visibility {
  return (session as { visibility?: string }).visibility === "team" ? "team" : "private";
}

export function isTemplate(session: CoachSession): boolean {
  return (session as { is_template?: boolean }).is_template === true;
}

/** Mallar användaren får se: egna mallar och lagets delade mallar. */
export function visibleTemplates(list: CoachSession[], userId: string | null): CoachSession[] {
  return list.filter((session) => {
    if (!isTemplate(session)) return false;
    if (session.user_id === userId) return true;
    return sessionVisibility(session) === "team" && !!session.team_id;
  });
}

/** Endast skaparen får byta namn, ändra delning eller radera mallen. */
export function canEditTemplate(session: CoachSession, userId: string | null): boolean {
  return !!userId && session.user_id === userId;
}

export function templateCard(session: CoachSession, items: CoachSessionItem[]): TemplateCard {
  const own = items.filter((item) => item.session_id === session.id);
  const visibility = sessionVisibility(session);
  return {
    id: session.id,
    title: session.title,
    minutes: own.reduce((sum, item) => sum + (Number.isFinite(item.minutes) ? item.minutes : 0), 0),
    ageGroup: session.age_group,
    gameFormat: session.game_format,
    theme: session.theme,
    itemCount: own.length,
    visibility,
    visibilityLabel: VISIBILITY_LABELS[visibility],
    updatedAt: session.updated_at,
    ownerId: session.user_id,
    teamId: session.team_id,
  };
}

export function templateCards(
  list: CoachSession[],
  items: CoachSessionItem[],
  userId: string | null,
): TemplateCard[] {
  return visibleTemplates(list, userId).map((session) => templateCard(session, items));
}

/* ---------- filter för Kopiera tidigare pass ---------- */

export const DURATION_BUCKETS = [45, 60, 75] as const;
export type DurationBucket = (typeof DURATION_BUCKETS)[number];

export type SessionFilters = {
  teamId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  theme?: string | null;
  ageGroup?: string | null;
  gameFormat?: string | null;
  duration?: DurationBucket | null;
  status?: "draft" | "done" | null;
};

/** Närmaste tidsfack: 45, 60 eller 75 minuter. */
export function durationBucket(minutes: number): DurationBucket {
  return DURATION_BUCKETS.reduce((best, bucket) =>
    Math.abs(bucket - minutes) < Math.abs(best - minutes) ? bucket : best,
  );
}

export function filterSessions(
  list: CoachSession[],
  items: CoachSessionItem[],
  filters: SessionFilters,
): CoachSession[] {
  return list.filter((session) => {
    if (isTemplate(session)) return false;
    if (filters.teamId && session.team_id !== filters.teamId) return false;
    if (filters.theme && (session.theme ?? "") !== filters.theme) return false;
    if (filters.ageGroup && (session.age_group ?? "") !== filters.ageGroup) return false;
    if (filters.gameFormat && (session.game_format ?? "") !== filters.gameFormat) return false;
    if (filters.status && session.status !== filters.status) return false;
    if (filters.fromDate && (session.session_date ?? "") < filters.fromDate) return false;
    if (filters.toDate && (session.session_date ?? "9999-12-31") > filters.toDate) return false;
    if (filters.duration) {
      const minutes = items
        .filter((item) => item.session_id === session.id)
        .reduce((sum, item) => sum + item.minutes, 0);
      if (minutes === 0 || durationBucket(minutes) !== filters.duration) return false;
    }
    return true;
  });
}

/* ---------- databas ---------- */

/** Kopierar ett pass eller en mall till ett nytt fristående pass. Datum följer aldrig med. */
export async function copySession(input: {
  sourceId: string;
  title?: string | null;
  teamId?: string | null;
  asTemplate?: boolean;
}): Promise<string> {
  const { data, error } = await supabase.rpc("copy_coach_session", {
    _source: input.sourceId,
    ...(input.title ? { _title: input.title } : {}),
    ...(input.teamId ? { _team_id: input.teamId } : {}),
    _as_template: input.asTemplate ?? false,
  });
  if (error) throw new Error(error.message);
  return data as unknown as string;
}

/** Gör om ett pass till en mall, eller ändrar mallens delning. */
export async function setTemplate(input: {
  sessionId: string;
  isTemplate: boolean;
  visibility: Visibility;
  teamId?: string | null;
}) {
  const patch = {
    is_template: input.isTemplate,
    visibility: input.visibility,
    ...(input.visibility === "team" ? { team_id: input.teamId ?? null } : {}),
  };
  const { error } = await supabase
    .from("coach_sessions")
    .update(patch)
    .eq("id", input.sessionId);
  if (error) throw new Error(error.message);
}

export async function renameSession(sessionId: string, title: string) {
  const clean = title.trim();
  if (!clean) throw new Error("Skriv ett namn på mallen.");
  const { error } = await supabase
    .from("coach_sessions")
    .update({ title: clean.slice(0, 200) })
    .eq("id", sessionId);
  if (error) throw new Error(error.message);
}
