/**
 * Gemensam statusregel för både match och träning.
 * Endast två synliga statusar finns: Klar (grön) och Ej klar (röd).
 */
export type PlanStatus = "done" | "todo";

export type PlanStatusInput = {
  /** "match" eller "training". */
  type: string | null | undefined;
  /** Sann när en planering är sparad för aktiviteten. */
  planSaved: boolean;
  /** Antal planrader (övningar/träningspass) i träningen. */
  resourceCount?: number;
  /** Antal uttagna spelare i matchen. */
  playerCount?: number;
  /** Antal valda ledare i matchen. */
  coachCount?: number;
};

/**
 * Match är klar när planeringen är sparad och minst en spelare och en ledare valts.
 * Träning är klar när planeringen är sparad och minst en övning finns.
 */
export function planStatus(input: PlanStatusInput): PlanStatus {
  if (!input.planSaved) return "todo";
  if (input.type === "match") {
    return (input.playerCount ?? 0) > 0 && (input.coachCount ?? 0) > 0 ? "done" : "todo";
  }
  return (input.resourceCount ?? 0) > 0 ? "done" : "todo";
}

export function planStatusLabel(status: PlanStatus): "Klar" | "Ej klar" {
  return status === "done" ? "Klar" : "Ej klar";
}

/** Räknar rader per aktivitet, används av listorna. */
export function countBy<T extends { event_id: string }>(rows: T[], eventId: string): number {
  return rows.filter((row) => row.event_id === eventId).length;
}
