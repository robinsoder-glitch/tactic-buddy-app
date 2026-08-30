import { supabase } from "@/integrations/supabase/client";

export type PlayerStatRow = {
  id: string;
  player_id: string;
  team_id: string;
  competition: string;
  matches: number;
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  points: number;
};

export type PlayerStatInput = Omit<PlayerStatRow, "id"> & { id?: string };

const COLUMNS =
  "id, player_id, team_id, competition, matches, goals, assists, yellow_cards, red_cards, points";

export async function fetchPlayerStats(playerId: string): Promise<PlayerStatRow[]> {
  const { data, error } = await supabase
    .from("player_stats")
    .select(COLUMNS)
    .eq("player_id", playerId)
    .order("competition");
  if (error) throw error;
  return (data ?? []) as unknown as PlayerStatRow[];
}

export async function savePlayerStat(input: PlayerStatInput, userId: string) {
  const clean = normalizeStat(input);
  if (input.id) {
    const { error } = await supabase.from("player_stats").update(clean).eq("id", input.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("player_stats").insert({ ...clean, created_by: userId });
  if (error) throw error;
}

export async function deletePlayerStat(id: string) {
  const { error } = await supabase.from("player_stats").delete().eq("id", id);
  if (error) throw error;
}

/** Håller siffrorna inom rimliga gränser och trimmar textfältet. */
export function normalizeStat(input: PlayerStatInput) {
  const number = (value: number) => Math.min(999, Math.max(0, Math.round(Number(value) || 0)));
  return {
    player_id: input.player_id,
    team_id: input.team_id,
    competition: input.competition.trim().slice(0, 60) || "Serie",
    matches: number(input.matches),
    goals: number(input.goals),
    assists: number(input.assists),
    yellow_cards: number(input.yellow_cards),
    red_cards: number(input.red_cards),
    points: number(input.points),
  };
}

export function statTotals(rows: PlayerStatRow[]) {
  return rows.reduce(
    (sum, row) => ({
      matches: sum.matches + row.matches,
      goals: sum.goals + row.goals,
      assists: sum.assists + row.assists,
      yellow_cards: sum.yellow_cards + row.yellow_cards,
      red_cards: sum.red_cards + row.red_cards,
      points: sum.points + row.points,
    }),
    { matches: 0, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, points: 0 },
  );
}

export const emptyStat = (playerId: string, teamId: string): PlayerStatInput => ({
  player_id: playerId,
  team_id: teamId,
  competition: "",
  matches: 0,
  goals: 0,
  assists: 0,
  yellow_cards: 0,
  red_cards: 0,
  points: 0,
});
