/** Hjälpfunktioner för månadskalendern i /kalender. */

export const MONTH_NAMES = [
  "januari",
  "februari",
  "mars",
  "april",
  "maj",
  "juni",
  "juli",
  "augusti",
  "september",
  "oktober",
  "november",
  "december",
] as const;

/** Veckan börjar på måndag, som i svensk kalender. */
export const WEEKDAY_NAMES = ["mån", "tis", "ons", "tor", "fre", "lör", "sön"] as const;

export type MonthCursor = { year: number; month: number };

export type MonthDay = {
  /** Lokalt datum på formen ÅÅÅÅ-MM-DD. */
  key: string;
  date: Date;
  dayOfMonth: number;
  inMonth: boolean;
};

/** Lokal datumnyckel utan tidszonsförskjutning. */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function monthLabel(cursor: MonthCursor): string {
  return `${MONTH_NAMES[cursor.month]} ${cursor.year}`;
}

export function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const total = cursor.year * 12 + cursor.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** Start och slut (exklusivt) för månaden, i ISO – för databasfrågan. */
export function monthRange(cursor: MonthCursor): { fromIso: string; toIso: string } {
  const from = new Date(cursor.year, cursor.month, 1, 0, 0, 0, 0);
  const next = shiftMonth(cursor, 1);
  const to = new Date(next.year, next.month, 1, 0, 0, 0, 0);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

/** Hela rutnätet: alltid hela veckor, måndag först. */
export function monthGrid(cursor: MonthCursor): MonthDay[] {
  const first = new Date(cursor.year, cursor.month, 1);
  const offset = (first.getDay() + 6) % 7; // måndag = 0
  const start = new Date(cursor.year, cursor.month, 1 - offset);
  const days: MonthDay[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    days.push({
      key: dayKey(date),
      date,
      dayOfMonth: date.getDate(),
      inMonth: date.getMonth() === cursor.month && date.getFullYear() === cursor.year,
    });
  }
  // Sista veckan behövs bara när månaden sträcker sig in i den.
  return days.slice(0, days[35]?.inMonth || days[41]?.inMonth ? 42 : 35);
}

/** Grupperar aktiviteter på lokal dag. */
export function groupByDay<T extends { starts_at: string }>(events: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const event of events) {
    const key = dayKey(new Date(event.starts_at));
    const bucket = map.get(key);
    if (bucket) bucket.push(event);
    else map.set(key, [event]);
  }
  return map;
}
