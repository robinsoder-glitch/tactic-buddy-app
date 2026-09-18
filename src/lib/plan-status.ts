/**
 * Gemensam statusregel för både match och träning.
 * Endast två synliga statusar finns: Planerad (grön) och Ej planerad (röd).
 *
 * Databasens planning_done är den auktoritativa källan: träningar kräver
 * övning, fokusområde och mål (eller att tränaren markerat klart), matcher
 * räknas som planerade när planen sparats. Alla vyer ska skicka med
 * planningDone så att listor, detaljvyer och databasen alltid säger samma sak.
 * Räkneverken nedan är bara en reservväg för anrop som saknar planraden.
 */
export type PlanStatus = "done" | "todo";

export type PlanStatusInput = {
  /** "match" eller "training". */
  type: string | null | undefined;
  /** Sann när en planering är sparad för aktiviteten. */
  planSaved: boolean;
  /**
   * Databasens planning_done för aktiviteten. Skicka alltid med när planraden
   * är hämtad – annars riskerar vyn att visa en annan status än databasen.
   */
  planningDone?: boolean | undefined;
  /** Antal planrader (övningar/träningspass) i träningen. */
  resourceCount?: number;
  /** Antal uttagna spelare i matchen. */
  playerCount?: number;
  /** Antal valda ledare i matchen. */
  coachCount?: number;
};

export function planStatus(input: PlanStatusInput): PlanStatus {
  if (!input.planSaved) return "todo";
  if (input.planningDone !== undefined) return input.planningDone ? "done" : "todo";
  // Reservväg utan planradens status – samma krav som tidigare.
  if (input.type === "match") {
    return (input.playerCount ?? 0) > 0 && (input.coachCount ?? 0) > 0 ? "done" : "todo";
  }
  return (input.resourceCount ?? 0) > 0 ? "done" : "todo";
}

/**
 * "Planerad" i stället för "Klar": planen är sparad, men det betyder inte att
 * truppen är fullbemannad – få spelare tillåts med en bekräftelse.
 */
export function planStatusLabel(status: PlanStatus): "Planerad" | "Ej planerad" {
  return status === "done" ? "Planerad" : "Ej planerad";
}

export function planStatusHint(status: PlanStatus): string {
  return status === "done"
    ? "Planeringen är sparad. Det betyder inte att truppen är fullbemannad – kontrollera antalet spelare."
    : "Planeringen är inte klar ännu – för en träning krävs övning, fokusområde och mål, eller att du markerar den som klar.";
}

/** Räknar rader per aktivitet, används av listorna. */
export function countBy<T extends { event_id: string }>(rows: T[], eventId: string): number {
  return rows.filter((row) => row.event_id === eventId).length;
}
