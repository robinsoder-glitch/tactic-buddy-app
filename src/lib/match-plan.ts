import { supabase } from "@/integrations/supabase/client";
import { FORMATIONS } from "@/lib/formations";
import type { InviteStatus } from "@/lib/invitations";

/** En planposition i laguppställningen. player_id null = Tom plats. */
export type LineupSlot = {
  slot: number;
  player_id: string | null;
  x: number;
  y: number;
  gk?: boolean;
};

export type MatchLineup = {
  event_id: string;
  team_id: string;
  formation: string;
  slots: LineupSlot[];
  bench: string[];
  tactic_id: string | null;
};

/** Antal startspelare per spelform. */
export const FORMAT_PLAYERS: Record<string, number> = {
  "3v3": 3,
  "5v5": 5,
  "7v7": 7,
  "9v9": 9,
  "11v11": 11,
};

export const FORMAT_LABELS: Record<string, string> = {
  "3v3": "3 mot 3",
  "5v5": "5 mot 5",
  "7v7": "7 mot 7",
  "9v9": "9 mot 9",
  "11v11": "11 mot 11",
};

export const FORMAT_IDS = Object.keys(FORMAT_PLAYERS);

/** Standardpositioner för ett format (första formationen i formationsbiblioteket). */
export function defaultSlots(format: string): LineupSlot[] {
  const formation = FORMATIONS.find((f) => f.id.startsWith(`${format}-`));
  const base = formation?.slots ?? [];
  return base.map((s, i) => ({ slot: i + 1, player_id: null, x: s.x, y: s.y, ...(s.gk ? { gk: true } : {}) }));
}

/** Startspelare = positioner med spelare, i slotordning. */
export function lineupStarters(slots: LineupSlot[]): string[] {
  return slots.filter((s) => s.player_id).map((s) => s.player_id!);
}

/** Placera spelare på en position. Flyttar spelaren om den redan finns någon annanstans. */
export function assignPlayerToSlot(
  slots: LineupSlot[],
  bench: string[],
  playerId: string,
  slotIndex: number,
): { slots: LineupSlot[]; bench: string[] } {
  const nextBench = bench.filter((id) => id !== playerId);
  const nextSlots = slots.map((s, i) => {
    if (s.player_id === playerId && i !== slotIndex) return { ...s, player_id: null };
    return s;
  });
  const target = nextSlots[slotIndex];
  if (!target) return { slots, bench };
  // Om platsen var upptagen flyttas den spelaren till bänken.
  if (target.player_id && target.player_id !== playerId) nextBench.push(target.player_id);
  nextSlots[slotIndex] = { ...target, player_id: playerId };
  return { slots: nextSlots, bench: nextBench };
}

/** Flytta en planposition tillbaka till bänken. */
export function moveSlotToBench(
  slots: LineupSlot[],
  bench: string[],
  slotIndex: number,
): { slots: LineupSlot[]; bench: string[] } {
  const target = slots[slotIndex];
  if (!target?.player_id) return { slots, bench };
  return {
    slots: slots.map((s, i) => (i === slotIndex ? { ...s, player_id: null } : s)),
    bench: [...bench, target.player_id],
  };
}

/** Ta bort en spelare helt ur uppställningen (vid ändrad uttagning). */
export function removePlayerFromLineup(
  slots: LineupSlot[],
  bench: string[],
  playerId: string,
): { slots: LineupSlot[]; bench: string[]; wasOnPitch: boolean } {
  const wasOnPitch = slots.some((s) => s.player_id === playerId);
  return {
    slots: slots.map((s) => (s.player_id === playerId ? { ...s, player_id: null } : s)),
    bench: bench.filter((id) => id !== playerId),
    wasOnPitch,
  };
}

/** Spelare i uttagningen som varken står på planen eller bänken hamnar på bänken. */
export function syncLineupWithSquad(
  slots: LineupSlot[],
  squad: string[],
): { slots: LineupSlot[]; bench: string[]; removedFromPitch: string[] } {
  const removedFromPitch: string[] = [];
  const nextSlots = slots.map((s) => {
    if (s.player_id && !squad.includes(s.player_id)) {
      removedFromPitch.push(s.player_id);
      return { ...s, player_id: null };
    }
    return s;
  });
  const onPitch = new Set(lineupStarters(nextSlots));
  const bench = squad.filter((id) => !onPitch.has(id));
  return { slots: nextSlots, bench, removedFromPitch };
}

const RESPONSE_ORDER: Record<InviteStatus, number> = {
  attending: 0,
  maybe: 1,
  pending: 2,
  declined: 3,
};

/** Sortera spelare efter svarstatus: Kommer, Kanske, Ej svarat, Kan inte. */
export function sortPlayersByResponse<T extends { id: string; name: string }>(
  players: T[],
  statusByPlayer: Map<string, InviteStatus>,
): T[] {
  return [...players].sort((a, b) => {
    const ra = RESPONSE_ORDER[statusByPlayer.get(a.id) ?? "pending"];
    const rb = RESPONSE_ORDER[statusByPlayer.get(b.id) ?? "pending"];
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name, "sv");
  });
}

/** Klientvalidering före sparning (samma regler som databasen kontrollerar). */
export function validateMatchPlan(input: {
  playerIds: string[];
  coachIds: string[];
  slots: LineupSlot[];
  bench: string[];
  required: number;
}): string | null {
  if (input.playerIds.length === 0) return "Välj minst en spelare.";
  if (input.coachIds.length === 0) return "Välj minst en ledare.";
  const starters = lineupStarters(input.slots);
  if (new Set(starters).size !== starters.length) return "Samma spelare kan bara stå på en planposition.";
  if (starters.length !== input.required)
    return `Det måste vara exakt ${input.required} startspelare för vald spelform (nu ${starters.length}).`;
  const all = [...starters, ...input.bench];
  if (new Set(all).size !== all.length) return "En avbytare kan inte samtidigt stå på planen.";
  if (all.some((id) => !input.playerIds.includes(id))) return "Alla spelare på planen och bänken måste ingå i uttagningen.";
  if (input.slots.some((s) => s.x < 0 || s.x > 1 || s.y < 0 || s.y > 1)) return "Alla planpositioner måste ligga innanför planen.";
  return null;
}

/** Samlingstiden måste vara före matchstart. */
export function validateMeetBeforeStart(meetAt: string | null, startsAt: string): string | null {
  if (!meetAt) return null;
  return new Date(meetAt).getTime() < new Date(startsAt).getTime()
    ? null
    : "Samlingstiden måste vara före matchstart.";
}

export async function fetchLineup(eventId: string): Promise<MatchLineup | null> {
  const { data, error } = await supabase
    .from("match_lineups")
    .select("event_id, team_id, formation, slots, bench, tactic_id")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    event_id: data.event_id,
    team_id: data.team_id,
    formation: data.formation,
    slots: (data.slots as unknown as LineupSlot[]) ?? [],
    bench: ((data.bench as unknown as string[]) ?? []).map(String),
    tactic_id: data.tactic_id,
  };
}

/** Sparar hela matchplanen atomiskt via RPC. */
export async function saveMatchPlanFull(input: {
  eventId: string;
  teamId: string;
  notes: string;
  playerIds: string[];
  coachIds: string[];
  formation: string;
  slots: LineupSlot[];
  bench: string[];
  tacticId: string | null;
  required: number;
}) {
  const { error } = await supabase.rpc("save_match_plan", {
    _event_id: input.eventId,
    _team_id: input.teamId,
    _notes: input.notes,
    _player_ids: input.playerIds,
    _coach_ids: input.coachIds,
    _formation: input.formation,
    _slots: JSON.parse(JSON.stringify(input.slots)),
    _bench: input.bench,
    _tactic_id: input.tacticId as string,
    _required: input.required,
  });
  if (error) throw new Error(error.message);
}

// ---------- Delningslänk ----------

export type MatchShare = {
  id: string;
  event_id: string;
  token: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export async function fetchMatchShare(eventId: string): Promise<MatchShare | null> {
  const { data, error } = await supabase
    .from("match_shares")
    .select("id, event_id, token, expires_at, revoked_at")
    .eq("event_id", eventId)
    .maybeSingle();
  if (error) throw error;
  return (data as MatchShare | null) ?? null;
}

export async function createMatchShare(input: {
  eventId: string;
  teamId: string;
  expiresAt: string | null;
}): Promise<MatchShare> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("match_shares")
    .insert({ event_id: input.eventId, team_id: input.teamId, expires_at: input.expiresAt, created_by: auth.user?.id ?? "" })
    .select("id, event_id, token, expires_at, revoked_at")
    .single();
  if (error) throw error;
  return data as MatchShare;
}

export async function revokeMatchShare(id: string) {
  const { error } = await supabase
    .from("match_shares")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export type SharedMatch = {
  opponent: string | null;
  home_team: string | null;
  starts_at: string;
  meet_at: string | null;
  location: string | null;
  match_kind: string | null;
  team_name: string;
  formation: string;
  players: { name: string; number: number | null; slot: string; x: number; y: number; gk: boolean }[];
  bench: { name: string; number: number | null }[];
};

/** Skrivskyddad publik läsning via delningslänk. */
export async function fetchSharedMatch(token: string): Promise<SharedMatch | null> {
  const { data, error } = await supabase.rpc("get_shared_match", { _token: token });
  if (error) throw error;
  return (data as SharedMatch | null) ?? null;
}
