/**
 * Hjälpfunktioner när tränaren godkänner en ansökan. Spelare och
 * vårdnadshavare måste kopplas till ett spelarkort som tränaren pekar ut –
 * appen och databasen gissar aldrig utifrån namn.
 */

export type ApprovalRole = "coach" | "head_coach" | "club_admin" | "player" | "guardian";

export type PlayerOption = { id: string; name: string; number?: number | null };

/** Sant när ansökan måste kopplas till ett spelarkort. */
export function needsPlayerCard(role: string | null | undefined): boolean {
  return role === "player" || role === "guardian";
}

/** Tröjnumret skiljer spelare med samma namn åt. */
export function playerOptionLabel(player: PlayerOption): string {
  return player.number != null ? `#${player.number} ${player.name}` : player.name;
}

/** Namn som förekommer flera gånger i truppen. */
export function duplicateNames(players: PlayerOption[]): string[] {
  const counts = new Map<string, number>();
  for (const player of players) {
    const key = player.name.trim().toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}

/** Texten i väljaren, med tydlig varning när flera spelare heter lika. */
export function approvalHelpText(role: string | null | undefined, players: PlayerOption[]): string {
  if (role === "guardian") {
    return duplicateNames(players).length > 0
      ? "Flera spelare har samma namn – välj rätt kort med hjälp av tröjnumret."
      : "Välj vilket barn personen är vårdnadshavare för.";
  }
  return duplicateNames(players).length > 0
    ? "Flera spelare har samma namn – välj rätt kort med hjälp av tröjnumret."
    : "Välj vilket spelarkort kontot ska kopplas till.";
}
