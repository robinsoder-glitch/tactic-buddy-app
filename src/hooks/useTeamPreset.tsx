import { useMemo } from "react";
import { useAccount } from "./useAccount";
import { isLeaderRole } from "@/lib/team-roles";
import { FORMAT_LABELS } from "@/lib/match-plan";
import type { PitchType } from "@/lib/tactics";

/** Planlayouten som hör ihop med lagets spelform. */
export function pitchForFormat(format: string | null | undefined): PitchType {
  switch (format) {
    case "11v11":
      return "full";
    case "9v9":
      return "nine";
    case "7v7":
      return "seven";
    case "5v5":
    case "3v3":
      return "five";
    default:
      return "full";
  }
}

/**
 * Lagets egna inställningar som ska vara förvalda i taktik, formationer och
 * platsfält. Tränaren anger spelform och hemmaplan när laget skapas – då ska
 * inget av det behöva väljas om vid varje match.
 */
export function useTeamPreset() {
  const { memberships } = useAccount();

  return useMemo(() => {
    const leaderTeam = memberships.find(
      (item) => isLeaderRole(item.role) && item.status === "approved",
    )?.team as { game_format?: string | null; home_ground?: string | null; name?: string } | null;

    const raw = leaderTeam?.game_format ?? null;
    const format = raw && FORMAT_LABELS[raw] ? raw : null;

    return {
      format,
      formatLabel: format ? FORMAT_LABELS[format]! : null,
      pitchType: format ? pitchForFormat(format) : null,
      homeGround: leaderTeam?.home_ground?.trim() || null,
      teamName: leaderTeam?.name ?? null,
    };
  }, [memberships]);
}
