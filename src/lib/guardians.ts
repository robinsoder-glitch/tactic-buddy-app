import { supabase } from "@/integrations/supabase/client";

/**
 * Kopplingar mellan vårdnadshavare och barn. Ett barn kan ha flera
 * vårdnadshavare och en vårdnadshavare kan ha flera barn. Kopplingen
 * avaktiveras (is_active = false) i stället för att raderas, så att
 * historiken finns kvar.
 */

export type GuardianLink = {
  id: string;
  player_id: string;
  guardian_user_id: string;
  relation: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  guardianName?: string | null;
  playerName?: string | null;
};

/** Spelar-id som den inloggade vårdnadshavaren får svara för. */
export async function fetchMyGuardedPlayerIds(
  userId: string | null | undefined,
): Promise<string[]> {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("player_guardians")
    .select("player_id")
    .eq("guardian_user_id", userId)
    .eq("is_active", true);
  if (error) throw error;
  return (data ?? []).map((row) => row.player_id as string);
}

export async function fetchPlayerGuardians(playerId: string): Promise<GuardianLink[]> {
  const { data, error } = await supabase
    .from("player_guardians")
    .select("*")
    .eq("player_id", playerId)
    .order("created_at");
  if (error) throw error;

  const rows = (data ?? []) as unknown as GuardianLink[];
  if (rows.length === 0) return rows;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in(
      "id",
      rows.map((row) => row.guardian_user_id),
    );
  const names = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.display_name as string | null]),
  );

  return rows.map((row) => ({ ...row, guardianName: names.get(row.guardian_user_id) ?? null }));
}

/**
 * Kopplar en vårdnadshavare till ett barn. Databasen kontrollerar att den
 * inloggade är ledare i laget, att kontot är en godkänd medlem i samma lag
 * och att det inte är spelarens eget konto.
 */
export async function linkGuardian(input: {
  playerId: string;
  guardianUserId: string;
  relation: string | null;
}): Promise<void> {
  const { error } = await supabase.rpc("link_guardian", {
    _player_id: input.playerId,
    _guardian_user_id: input.guardianUserId,
    _relation: input.relation,
  } as never);
  if (error) throw error;
}

/** Avaktiverar eller återaktiverar kopplingen utan att förlora historik. */
export async function setGuardianActive(linkId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from("player_guardians")
    .update({ is_active: isActive })
    .eq("id", linkId);
  if (error) throw error;
}

/** Får den här användaren svara för spelaren? */
export function canGuardianRespond(input: {
  playerId: string;
  guardedPlayerIds: string[];
}): boolean {
  return input.guardedPlayerIds.includes(input.playerId);
}
