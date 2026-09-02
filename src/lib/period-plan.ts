import { supabase } from "@/integrations/supabase/client";

/** Ett periodblock på 4–6 veckor med ett huvudtema och högst två delteman. */
export type TeamPeriod = {
  id: string;
  team_id: string;
  name: string;
  start_date: string;
  end_date: string;
  main_theme: string;
  sub_themes: string[];
  goal: string | null;
};

export type PeriodLinkKind = "event" | "drill" | "tactic" | "article" | "session";

export const PERIOD_LINK_LABELS: Record<PeriodLinkKind, string> = {
  event: "Träning eller match",
  drill: "Övning",
  tactic: "Taktik",
  article: "Kunskapsartikel",
  session: "Träningspass",
};

export type PeriodLink = {
  id: string;
  period_id: string;
  kind: PeriodLinkKind;
  resource_id: string;
  label: string | null;
};

/** De fyra progressionsstegen i en period. */
export const PROGRESSION_STEPS = [
  { step: 1, label: "Introducera", help: "Visa och förklara temat på ett enkelt sätt." },
  { step: 2, label: "Öva", help: "Öva i lugna former med många repetitioner." },
  { step: 3, label: "Använd i spel", help: "Pröva temat i spel och matchlika övningar." },
  { step: 4, label: "Följ upp", help: "Se tillbaka: vad sitter och vad behöver mer tid?" },
] as const;

export type PeriodProgression = { id: string; period_id: string; step: number; notes: string | null };

export const FOCUS_STATUSES = ["active", "achieved", "paused"] as const;
export type FocusStatus = (typeof FOCUS_STATUSES)[number];

export const FOCUS_STATUS_LABELS: Record<FocusStatus, string> = {
  active: "Aktivt",
  achieved: "Uppnått",
  paused: "Pausat",
};

export const MAX_ACTIVE_FOCUS = 3;

export type FocusArea = {
  id: string;
  team_id: string;
  player_id: string;
  period_id: string | null;
  title: string;
  description: string | null;
  status: FocusStatus;
  created_at: string;
};

export type Observation = {
  id: string;
  team_id: string;
  player_id: string;
  focus_area_id: string | null;
  event_id: string | null;
  note: string;
  created_at: string;
};

/** Antal veckor i perioden, avrundat uppåt. */
export function periodWeeks(period: Pick<TeamPeriod, "start_date" | "end_date">): number {
  const days = (Date.parse(period.end_date) - Date.parse(period.start_date)) / 86_400_000;
  return Math.max(1, Math.round(days / 7));
}

/** Svenskt felmeddelande om perioden inte följer reglerna, annars null. */
export function validatePeriod(input: {
  name: string;
  start_date: string;
  end_date: string;
  main_theme: string;
  sub_themes: string[];
}): string | null {
  if (!input.name.trim()) return "Ge perioden ett namn.";
  if (!input.main_theme.trim()) return "Välj ett huvudtema för perioden.";
  if (!input.start_date || !input.end_date) return "Ange både start- och slutdatum.";
  if (Date.parse(input.end_date) <= Date.parse(input.start_date)) return "Slutdatumet måste vara efter startdatumet.";
  const weeks = periodWeeks({ start_date: input.start_date, end_date: input.end_date });
  if (weeks < 4 || weeks > 6) return "En period ska vara mellan fyra och sex veckor.";
  if (input.sub_themes.filter((theme) => theme.trim()).length > 2) return "Välj högst två delteman.";
  return null;
}

/** Kontroll innan ett nytt fokusområde skapas. */
export function canAddFocusArea(active: number): boolean {
  return active < MAX_ACTIVE_FOCUS;
}

/** Perioden som pågår vid ett visst datum. */
export function currentPeriod(periods: TeamPeriod[], onDate = new Date()): TeamPeriod | null {
  const day = onDate.toISOString().slice(0, 10);
  return periods.find((period) => period.start_date <= day && period.end_date >= day) ?? null;
}

/** Perioden närmast före en given period. */
export function previousPeriod(periods: TeamPeriod[], period: TeamPeriod): TeamPeriod | null {
  return (
    periods
      .filter((item) => item.end_date < period.start_date)
      .sort((a, b) => b.end_date.localeCompare(a.end_date))[0] ?? null
  );
}

const PERIOD_COLUMNS = "id, team_id, name, start_date, end_date, main_theme, sub_themes, goal";

export async function fetchPeriods(teamId: string): Promise<TeamPeriod[]> {
  const { data, error } = await supabase
    .from("team_periods")
    .select(PERIOD_COLUMNS)
    .eq("team_id", teamId)
    .order("start_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as TeamPeriod[];
}

export async function createPeriod(input: Omit<TeamPeriod, "id">): Promise<string> {
  const problem = validatePeriod(input);
  if (problem) throw new Error(problem);
  const { data, error } = await supabase.from("team_periods").insert(input).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updatePeriod(id: string, patch: Partial<Omit<TeamPeriod, "id" | "team_id">>) {
  const { error } = await supabase.from("team_periods").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deletePeriod(id: string) {
  const { error } = await supabase.from("team_periods").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPeriodLinks(periodId: string): Promise<PeriodLink[]> {
  const { data, error } = await supabase
    .from("period_links")
    .select("id, period_id, kind, resource_id, label")
    .eq("period_id", periodId);
  if (error) throw error;
  return (data ?? []) as unknown as PeriodLink[];
}

/** Kopplar en resurs till perioden. Samma resurs kan bara kopplas en gång. */
export async function addPeriodLink(input: {
  periodId: string;
  kind: PeriodLinkKind;
  resourceId: string;
  label?: string | null;
}) {
  const { error } = await supabase.from("period_links").upsert(
    { period_id: input.periodId, kind: input.kind, resource_id: input.resourceId, label: input.label ?? null },
    { onConflict: "period_id,kind,resource_id" },
  );
  if (error) throw error;
}

export async function removePeriodLink(id: string) {
  const { error } = await supabase.from("period_links").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchProgression(periodId: string): Promise<PeriodProgression[]> {
  const { data, error } = await supabase
    .from("period_progression")
    .select("id, period_id, step, notes")
    .eq("period_id", periodId)
    .order("step");
  if (error) throw error;
  return (data ?? []) as unknown as PeriodProgression[];
}

export async function saveProgression(periodId: string, step: number, notes: string) {
  const { error } = await supabase
    .from("period_progression")
    .upsert({ period_id: periodId, step, notes }, { onConflict: "period_id,step" });
  if (error) throw error;
}

export async function fetchFocusAreas(teamId: string, playerId?: string): Promise<FocusArea[]> {
  let query = supabase
    .from("player_focus_areas")
    .select("id, team_id, player_id, period_id, title, description, status, created_at")
    .eq("team_id", teamId);
  if (playerId) query = query.eq("player_id", playerId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as FocusArea[];
}

export async function createFocusArea(input: {
  teamId: string;
  playerId: string;
  title: string;
  description?: string | null;
  periodId?: string | null;
}) {
  if (!input.title.trim()) throw new Error("Skriv vad spelaren ska träna på.");
  const existing = await fetchFocusAreas(input.teamId, input.playerId);
  if (!canAddFocusArea(existing.filter((area) => area.status === "active").length)) {
    throw new Error("Spelaren har redan tre aktiva fokusområden. Markera ett som uppnått eller pausat först.");
  }
  const { error } = await supabase.from("player_focus_areas").insert({
    team_id: input.teamId,
    player_id: input.playerId,
    title: input.title.trim(),
    description: input.description ?? null,
    period_id: input.periodId ?? null,
  });
  if (error) throw error;
}

export async function setFocusStatus(id: string, status: FocusStatus) {
  const { error } = await supabase.from("player_focus_areas").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteFocusArea(id: string) {
  const { error } = await supabase.from("player_focus_areas").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchObservations(teamId: string, playerId?: string): Promise<Observation[]> {
  let query = supabase
    .from("player_observations")
    .select("id, team_id, player_id, focus_area_id, event_id, note, created_at")
    .eq("team_id", teamId);
  if (playerId) query = query.eq("player_id", playerId);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Observation[];
}

export async function addObservation(input: {
  teamId: string;
  playerId: string;
  note: string;
  focusAreaId?: string | null;
  eventId?: string | null;
}) {
  if (!input.note.trim()) throw new Error("Skriv en kort observation.");
  const { error } = await supabase.from("player_observations").insert({
    team_id: input.teamId,
    player_id: input.playerId,
    note: input.note.trim(),
    focus_area_id: input.focusAreaId ?? null,
    event_id: input.eventId ?? null,
  });
  if (error) throw error;
}

export async function deleteObservation(id: string) {
  const { error } = await supabase.from("player_observations").delete().eq("id", id);
  if (error) throw error;
}

/** Lagöversikt utan topplista: bara hur många som har fokus och senaste observation. */
export function teamOverview(input: {
  players: { id: string; name: string }[];
  focus: FocusArea[];
  observations: Observation[];
}) {
  const withFocus = new Set(input.focus.filter((area) => area.status === "active").map((area) => area.player_id));
  const latest = new Map<string, string>();
  for (const observation of input.observations) {
    if (!latest.has(observation.player_id)) latest.set(observation.player_id, observation.created_at);
  }
  return {
    withFocus: input.players.filter((player) => withFocus.has(player.id)).length,
    withoutFocus: input.players.filter((player) => !withFocus.has(player.id)).length,
    latestObservation: input.players.map((player) => ({
      id: player.id,
      name: player.name,
      hasFocus: withFocus.has(player.id),
      lastObservation: latest.get(player.id) ?? null,
    })),
  };
}
