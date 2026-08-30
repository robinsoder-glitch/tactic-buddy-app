/**
 * Datum- och tidshantering för träningar och matcher.
 * Formuläret arbetar med ett datumfält (YYYY-MM-DD) och separata klockslag (HH:MM).
 * Exakt det värde som syns i fälten är också det som valideras och sparas.
 */

export type EventTimeForm = {
  date: string;
  start: string;
  end?: string;
  meet?: string;
};

export type EventTimeErrors = {
  date?: string;
  start?: string;
  end?: string;
  meet?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

export function isValidTime(value: string): boolean {
  if (!TIME_RE.test(value)) return false;
  const [h, min] = value.split(":").map(Number) as [number, number];
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

/** Slår ihop datum + klockslag till en tidpunkt i användarens tidszon. */
export function combineLocal(date: string, time: string): Date | null {
  if (!isValidDate(date) || !isValidTime(time)) return null;
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const [h, min] = time.split(":").map(Number) as [number, number];
  const result = new Date(y, m - 1, d, h, min, 0, 0);
  return Number.isNaN(result.getTime()) ? null : result;
}

/** ISO-sträng för databasen, eller null om värdet inte är komplett. */
export function toIso(date: string, time: string): string | null {
  const value = combineLocal(date, time);
  return value ? value.toISOString() : null;
}

/** Delar upp ett sparat värde i fältens datum och klockslag (lokal tid). */
export function splitLocal(value: string | null | undefined): { date: string; time: string } {
  if (!value) return { date: "", time: "" };
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`,
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}

/** Accepterar även äldre datetime-local-värden, t.ex. "2026-09-05T17:00". */
export function splitDateTimeLocal(value: string): { date: string; time: string } {
  const [date = "", rest = ""] = value.split("T");
  return { date, time: rest.slice(0, 5) };
}

/** Validerar formuläret och ger ett meddelande vid rätt fält. */
export function validateEventTimes(form: EventTimeForm): EventTimeErrors {
  const errors: EventTimeErrors = {};
  if (!form.date) errors.date = "Välj ett datum.";
  else if (!isValidDate(form.date)) errors.date = "Datumet ser inte rätt ut. Använd formatet ÅÅÅÅ-MM-DD.";

  if (!form.start) errors.start = "Ange en starttid.";
  else if (!isValidTime(form.start)) errors.start = "Starttiden ser inte rätt ut. Använd formatet TT:MM.";

  if (form.end) {
    if (!isValidTime(form.end)) errors.end = "Sluttiden ser inte rätt ut. Använd formatet TT:MM.";
    else if (!errors.date && !errors.start) {
      const start = combineLocal(form.date, form.start)!;
      const end = combineLocal(form.date, form.end)!;
      if (end.getTime() <= start.getTime()) errors.end = "Sluttiden måste vara efter starttiden.";
    }
  }

  if (form.meet) {
    if (!isValidTime(form.meet)) errors.meet = "Samlingstiden ser inte rätt ut. Använd formatet TT:MM.";
    else if (!errors.date && !errors.start) {
      const start = combineLocal(form.date, form.start)!;
      const meet = combineLocal(form.date, form.meet)!;
      if (meet.getTime() > start.getTime()) errors.meet = "Samlingen bör vara före starttiden.";
    }
  }

  return errors;
}

export function hasErrors(errors: EventTimeErrors): boolean {
  return Object.keys(errors).length > 0;
}
