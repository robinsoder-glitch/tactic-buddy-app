/**
 * Etapp 5 – tränaren skapar spelaren först och bjuder in direkt till
 * spelarkortet. Då blir anslutningen aldrig en separat ansökan att godkänna.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TeamInvite } from "@/lib/teams";

export type PlayerLink = {
  player_id: string;
  member_user_id: string | null;
  guardians: number;
};

export type PlayerLinkState = "linked" | "invited" | "none";

/** Rubriken på inbjudan så tränaren ser vem länken gäller. */
export function inviteRecipientLabel(playerName: string, kind: "player" | "guardian"): string {
  const name = playerName.trim() || "spelaren";
  return kind === "guardian" ? `Vårdnadshavare till ${name}` : name;
}

/** Öppna (ej använda, ej återkallade, ej utgångna) inbjudningar för ett spelarkort. */
export function openInvitesForPlayer(playerId: string, invites: TeamInvite[]): TeamInvite[] {
  const now = Date.now();
  return invites.filter(
    (invite) =>
      invite.target_player_id === playerId &&
      !invite.accepted_at &&
      !invite.revoked_at &&
      new Date(invite.expires_at).getTime() > now,
  );
}

export function playerLinkState(
  playerId: string,
  links: Record<string, PlayerLink>,
  invites: TeamInvite[],
): PlayerLinkState {
  const link = links[playerId];
  if (link && (link.member_user_id || link.guardians > 0)) return "linked";
  return openInvitesForPlayer(playerId, invites).length ? "invited" : "none";
}

export const PLAYER_LINK_LABELS: Record<PlayerLinkState, string> = {
  linked: "Kopplat konto",
  invited: "Inbjudan skickad",
  none: "Inget konto ännu",
};

/** Vem som är kopplad, skrivet så en tränare förstår. */
export function playerLinkDetail(link: PlayerLink | undefined): string {
  if (!link) return "Ingen koppling ännu.";
  const parts: string[] = [];
  if (link.member_user_id) parts.push("spelaren har eget konto");
  if (link.guardians === 1) parts.push("1 vårdnadshavare kopplad");
  if (link.guardians > 1) parts.push(`${link.guardians} vårdnadshavare kopplade`);
  return parts.length ? parts.join(" · ") : "Ingen koppling ännu.";
}

/* ---------------- data ---------------- */

/** Hämtar vilka spelarkort som redan har konto eller vårdnadshavare. */
export async function fetchPlayerLinks(teamId: string): Promise<Record<string, PlayerLink>> {
  const { data, error } = await supabase
    .from("players")
    .select("id, member_user_id")
    .eq("team_id", teamId);
  if (error) throw error;

  const links: Record<string, PlayerLink> = {};
  for (const row of data ?? []) {
    links[row.id as string] = {
      player_id: row.id as string,
      member_user_id: (row as { member_user_id: string | null }).member_user_id ?? null,
      guardians: 0,
    };
  }

  const ids = Object.keys(links);
  if (ids.length) {
    const guardians = await supabase
      .from("player_guardians")
      .select("player_id")
      .in("player_id", ids)
      .eq("is_active", true);
    if (!guardians.error) {
      for (const row of guardians.data ?? []) {
        const link = links[row.player_id as string];
        if (link) link.guardians += 1;
      }
    }
  }

  return links;
}
