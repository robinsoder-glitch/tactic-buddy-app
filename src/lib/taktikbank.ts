import { supabase } from "@/integrations/supabase/client";
import type { Drawing, FieldObject, Frame } from "./tactics";

/* ---------- typer som speglar seed-datan ---------- */

export type Source = {
  sourceType: "official_rule" | "official_coaching" | "editorial_synthesis";
  title: string;
  url?: string;
  reviewedAt?: string;
  licenseStatus?: string;
};

export type Actor = {
  id: string;
  team: "home" | "away";
  roleId: string;
  x: number;
  y: number;
};

export type Arrow = {
  kind: "run" | "pass" | "dribble" | "press" | string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  label?: string;
};

export type Keyframe = {
  id: string;
  kind: "start" | "movement" | "decision";
  durationMs: number;
  easing?: string;
  caption?: string;
  actorPositions: { actorId: string; x: number; y: number }[];
  ball?: { x: number; y: number; attachedTo?: string | null } | null;
  arrows?: Arrow[];
};

export type TacticCardData = {
  id: string;
  title: string;
  format: string;
  ageFit?: { min: number; max: number };
  difficulty: number;
  gameMoment: string;
  phase: string;
  purpose: string;
  formationRef?: string;
  trigger?: string;
  childCue?: string;
  coachQuestion?: string;
  decisionRule?: string;
  roleActions?: { roleId: string; action: string }[];
  commonError?: string;
  correction?: string;
  successSign?: string;
  linkedDrillIds?: string[];
  actors: Actor[];
  keyframes: Keyframe[];
  imageScript?: { id?: string; caption?: string; description?: string }[];
  sources?: Source[];
};

export type TacticCard = {
  id: string;
  title: string;
  format: string;
  difficulty: number;
  game_moment: string | null;
  phase: string | null;
  purpose: string | null;
  formation_ref: string | null;
  data: TacticCardData;
};

export type GoalkeeperCardData = {
  id: string;
  title: string;
  purpose?: string;
  trigger?: string;
  childCues?: string[];
  steps?: string[];
  commonErrors?: string[];
  linkedDrillIds?: string[];
  sources?: Source[];
};

export type GoalkeeperCard = { id: string; title: string; purpose: string | null; data: GoalkeeperCardData };

/** Full mall för en övning i Övningsbanken. */
export type DrillData = {
  id: string;
  title: string;
  defaultMinutes?: number;
  purpose?: string;
  linkedTacticIds?: string[];
  /** Spelform övningen är skriven för, t.ex. "5v5". */
  format?: string;
  /** Åldersspann övningen passar. */
  ageFit?: { min: number; max: number };
  /** Ytan i meter, t.ex. "20 x 25 m". */
  area?: string;
  /** Antal spelare, t.ex. "6–10 spelare, 2 lag". */
  players?: string;
  /** Utrustning som behövs. */
  equipment?: string[];
  /** Så ställer du upp övningen. */
  organisation?: string[];
  /** Så genomförs övningen. */
  execution?: string[];
  /** Det tränaren tittar efter och coachar på. */
  coachingPoints?: string[];
  /** Frågor att ställa till spelarna. */
  coachQuestions?: string[];
  /** Så gör du övningen lättare. */
  simplify?: string[];
  /** Så gör du övningen svårare. */
  challenge?: string[];
  /** Tecken på att övningen fungerar. */
  successSigns?: string[];
  /** Säkerhet och hänsyn. */
  safety?: string;
  sources?: Source[];
};

export type Drill = {
  id: string;
  title: string;
  default_minutes: number | null;
  purpose: string | null;
  data: DrillData;
};

export type SessionBlock = {
  order: number;
  minutes: number;
  activity: string;
  drillId?: string;
  kind: string;
  focus?: string;
};

export type TrainingSessionData = {
  id: string;
  title: string;
  totalMinutes?: number;
  theme?: string;
  coachLimit?: string;
  blocks: SessionBlock[];
  sources?: Source[];
};

export type TrainingSessionCard = {
  id: string;
  title: string;
  total_minutes: number | null;
  theme: string | null;
  data: TrainingSessionData;
};

export type Formation = {
  id: string;
  format: string;
  name: string;
  data: {
    id: string;
    name: string;
    format: string;
    outfieldShape?: string;
    roles?: string[];
    positions: { roleId: string; x: number; y: number }[];
  };
};

export type Ruleset = {
  id: string;
  format: string;
  season: string | null;
  data: Record<string, unknown>;
};

export type DistrictProfile = { id: string; name: string; data: Record<string, unknown> };

/* ---------- hämtning ---------- */

export async function fetchTacticCards(): Promise<TacticCard[]> {
  const { data, error } = await supabase
    .from("tb_tactics")
    .select("id, title, format, difficulty, game_moment, phase, purpose, formation_ref, data")
    .order("id");
  if (error) throw error;
  return (data ?? []) as unknown as TacticCard[];
}

export async function fetchTacticCard(id: string): Promise<TacticCard> {
  const { data, error } = await supabase
    .from("tb_tactics")
    .select("id, title, format, difficulty, game_moment, phase, purpose, formation_ref, data")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as TacticCard;
}

export async function fetchGoalkeeperCards(): Promise<GoalkeeperCard[]> {
  const { data, error } = await supabase
    .from("tb_goalkeeper_cards")
    .select("id, title, purpose, data")
    .order("id");
  if (error) throw error;
  return (data ?? []) as unknown as GoalkeeperCard[];
}

export async function fetchDrills(): Promise<Drill[]> {
  const { data, error } = await supabase
    .from("tb_drills")
    .select("id, title, default_minutes, purpose, data")
    .order("id");
  if (error) throw error;
  return (data ?? []) as unknown as Drill[];
}

export async function fetchDrill(id: string): Promise<Drill> {
  const { data, error } = await supabase
    .from("tb_drills")
    .select("id, title, default_minutes, purpose, data")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as Drill;
}


export async function fetchTrainingSessions(): Promise<TrainingSessionCard[]> {
  const { data, error } = await supabase
    .from("tb_training_sessions")
    .select("id, title, total_minutes, theme, data")
    .order("id");
  if (error) throw error;
  return (data ?? []) as unknown as TrainingSessionCard[];
}

export async function fetchFormations(): Promise<Formation[]> {
  const { data, error } = await supabase.from("tb_formations").select("id, format, name, data").order("id");
  if (error) throw error;
  return (data ?? []) as unknown as Formation[];
}

export async function fetchRulesets(): Promise<Ruleset[]> {
  const { data, error } = await supabase.from("tb_rulesets").select("id, format, season, data").order("id");
  if (error) throw error;
  return (data ?? []) as unknown as Ruleset[];
}

export async function fetchDistrictProfiles(): Promise<DistrictProfile[]> {
  const { data, error } = await supabase.from("tb_district_profiles").select("id, name, data").order("id");
  if (error) throw error;
  return (data ?? []) as unknown as DistrictProfile[];
}

/* ---------- favoriter ---------- */

export type FavoriteKind = "tactic" | "goalkeeper" | "drill" | "session" | "article";

export type Favorite = { kind: FavoriteKind; resource_id: string };

export async function fetchFavorites(): Promise<Favorite[]> {
  const { data, error } = await supabase.from("tb_favorites").select("kind, resource_id");
  if (error) throw error;
  return (data ?? []) as Favorite[];
}

export async function addFavorite(userId: string, kind: FavoriteKind, resourceId: string) {
  const { error } = await supabase
    .from("tb_favorites")
    .insert({ user_id: userId, kind, resource_id: resourceId });
  if (error && error.code !== "23505") throw error;
}

export async function removeFavorite(userId: string, kind: FavoriteKind, resourceId: string) {
  const { error } = await supabase
    .from("tb_favorites")
    .delete()
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("resource_id", resourceId);
  if (error) throw error;
}

/* ---------- etiketter ---------- */


/**
 * Svenska etiketter för alla spelmoment och faser som finns i banken.
 * Databasvärdena ändras aldrig – översättningen sker enbart här i presentationslagret.
 */
const MOMENT_AND_PHASE_LABELS: Record<string, string> = {
  own_possession: "Vi har bollen",
  opponent_possession: "Motståndaren har bollen",
  transition_to_attack: "Offensiv omställning",
  transition_to_defence: "Defensiv omställning",
  offensive_transition: "Offensiv omställning",
  defensive_transition: "Defensiv omställning",
  ball_win: "Bollvinst",
  ball_loss: "Bolltapp",
  set_piece: "Fast situation",
  corner: "Hörna",
  restart: "Igångsättning",
  goalkeeper_restart: "Målvaktsstart",
  goalkeeper_start: "Målvaktsstart",
  touchline_restart: "Igångsättning från sidlinjen",
  build_up: "Uppspel",
  attack: "Anfall",
  finishing: "Avslut",
  create_chance: "Chansskapande",
  progress: "Spela framåt",
  numerical_advantage: "Numerärt överläge",
  defend_goal: "Målförsvar",
  defence: "Försvar",
  defending: "Försvar",
  pressing: "Press",
  recovery: "Återhämtning",
};

export const GAME_MOMENT_LABELS: Record<string, string> = { ...MOMENT_AND_PHASE_LABELS };

export const PHASE_LABELS: Record<string, string> = { ...MOMENT_AND_PHASE_LABELS };

export const SOURCE_TYPE_LABELS: Record<string, string> = {
  official_rule: "Officiell regel",
  official_coaching: "Officiellt tränarstöd",
  editorial_synthesis: "Redaktionellt innehåll",
};

export const ROLE_LABELS: Record<string, string> = {
  goalkeeper: "Målvakt",
  low_support: "Lågt understöd",
  wide_left: "Vänster ytter",
  wide_right: "Höger ytter",
  high: "Hög spelare",
  extra_player: "Extraspelare",
  nearest: "Närmast bollen",
  farthest: "Längst från bollen",
  ball_carrier: "Bollhållare",
};

/** Sista skyddsnät: ingen okänd nyckel får visas som engelsk text med understreck. */
const FALLBACK_LABELS: Record<string, string> = { ...MOMENT_AND_PHASE_LABELS, ...ROLE_LABELS };

export function label(map: Record<string, string>, key: string | null | undefined) {
  if (!key) return "";
  return map[key] ?? FALLBACK_LABELS[key] ?? key.replace(/_/g, " ");
}


/* ---------- konvertering till appens animationsmodell ---------- */

const MAX = 10000;

function norm(value: number, mirrored: boolean, axis: "x" | "y") {
  const v = value / MAX;
  return axis === "x" && mirrored ? 1 - v : v;
}

/**
 * Bygger frames av kortets kumulativa keyframes.
 * Varje keyframe ändrar endast angivna aktörer; övriga behåller föregående position.
 */
export function cardToFrames(card: TacticCardData, mirrored = false): Frame[] {
  const positions = new Map<string, { x: number; y: number }>();
  for (const actor of card.actors) positions.set(actor.id, { x: actor.x, y: actor.y });

  const roleName = (actor: Actor) => label(ROLE_LABELS, actor.roleId);

  return card.keyframes.map((keyframe, index) => {
    for (const update of keyframe.actorPositions ?? []) {
      positions.set(update.actorId, { x: update.x, y: update.y });
    }

    const objects: FieldObject[] = card.actors.map((actor) => {
      const position = positions.get(actor.id) ?? { x: actor.x, y: actor.y };
      return {
        id: actor.id,
        kind: "player",
        playerId: null,
        label: roleName(actor),
        number: null,
        team: actor.team,
        gk: actor.roleId === "goalkeeper",
        x: norm(position.x, mirrored, "x"),
        y: norm(position.y, mirrored, "y"),
      };
    });

    if (keyframe.ball) {
      objects.push({
        id: "ball",
        kind: "ball",
        label: "",
        team: "home",
        x: norm(keyframe.ball.x, mirrored, "x"),
        y: norm(keyframe.ball.y, mirrored, "y"),
      });
    }

    const drawings: Drawing[] = (keyframe.arrows ?? []).map((arrow, arrowIndex) => ({
      id: `${keyframe.id}-${arrowIndex}`,
      type: arrow.kind === "pass" ? "pass" : "run",
      x1: norm(arrow.from.x, mirrored, "x"),
      y1: norm(arrow.from.y, mirrored, "y"),
      x2: norm(arrow.to.x, mirrored, "x"),
      y2: norm(arrow.to.y, mirrored, "y"),
    }));

    return {
      id: keyframe.id,
      name: `Steg ${index + 1}`,
      note: keyframe.caption ?? null,
      objects,
      drawings,
    };
  });
}

/* ---------- kopplingar till träningstillfällen ---------- */

export type EventResourceKind = "tactic" | "drill" | "session" | "goalkeeper" | "article";

export type EventResource = {
  id: string;
  event_id: string;
  team_id: string;
  kind: EventResourceKind;
  resource_id: string;
  minutes: number | null;
  note: string | null;
};

export async function fetchEventResources(eventIds: string[]): Promise<EventResource[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await supabase
    .from("event_resources")
    .select("id, event_id, team_id, kind, resource_id, minutes, note")
    .in("event_id", eventIds);
  if (error) throw error;
  return (data ?? []) as unknown as EventResource[];
}

export async function addEventResource(input: {
  eventId: string;
  teamId: string;
  userId: string;
  kind: EventResourceKind;
  resourceId: string;
}) {
  const { error } = await supabase.from("event_resources").insert({
    event_id: input.eventId,
    team_id: input.teamId,
    created_by: input.userId,
    kind: input.kind,
    resource_id: input.resourceId,
  });
  if (error) throw error;
}

export async function removeEventResource(id: string) {
  const { error } = await supabase.from("event_resources").delete().eq("id", id);
  if (error) throw error;
}
