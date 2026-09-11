/** Logik för att tolka och rensa matcher som lästs in från PDF eller länk. */

export type RawImportedMatch = {
  date?: string | null;
  time?: string | null;
  home_team?: string | null;
  away_team?: string | null;
  location?: string | null;
  confidence?: number | null;
};

export type ImportedMatch = {
  /** Lokalt datum ÅÅÅÅ-MM-DD. */
  date: string;
  /** Lokal tid TT:MM. */
  time: string;
  home_team: string;
  away_team: string;
  location: string;
  /** Sant när något fält gissats och tränaren bör titta extra. */
  needsReview: boolean;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  maj: 5,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  okt: 10,
  oct: 10,
  nov: 11,
  dec: 12,
};

/** Gör om vanliga svenska datumformat till ÅÅÅÅ-MM-DD. Saknat år antas vara säsongsåret. */
export function normalizeDate(input: string | null | undefined, seasonYear: number): string | null {
  const text = (input ?? "").trim().toLowerCase();
  if (!text) return null;

  const iso = text.match(/^(\d{4})[-/. ](\d{1,2})[-/. ](\d{1,2})/);
  if (iso) return pad(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmy = text.match(/^(\d{1,2})[-/.](\d{1,2})(?:[-/.](\d{2,4}))?$/);
  if (dmy) {
    const year = dmy[3] ? expandYear(Number(dmy[3])) : seasonYear;
    return pad(year, Number(dmy[2]), Number(dmy[1]));
  }

  const named = text.match(/^(\d{1,2})\s*([a-zåäö]{3,})\.?\s*(\d{4})?$/);
  if (named) {
    const month = MONTHS[named[2]!.slice(0, 3)];
    if (!month) return null;
    return pad(named[3] ? Number(named[3]) : seasonYear, month, Number(named[1]));
  }
  return null;
}

function expandYear(year: number): number {
  return year < 100 ? 2000 + year : year;
}

function pad(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Gör om tider som "18.30", "1830" eller "kl 18:30" till TT:MM. */
export function normalizeTime(input: string | null | undefined): string | null {
  const text = (input ?? "").trim().toLowerCase().replace(/^kl\.?\s*/, "");
  if (!text) return null;
  const colon = text.match(/^(\d{1,2})[:.](\d{2})/);
  if (colon) return clampTime(Number(colon[1]), Number(colon[2]));
  const compact = text.match(/^(\d{2})(\d{2})$/);
  if (compact) return clampTime(Number(compact[1]), Number(compact[2]));
  const hourOnly = text.match(/^(\d{1,2})$/);
  if (hourOnly) return clampTime(Number(hourOnly[1]), 0);
  return null;
}

function clampTime(hour: number, minute: number): string | null {
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function cleanText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** Rensar AI-svaret till matcher som går att spara. Rader utan datum försvinner. */
export function normalizeImportedMatches(
  rows: RawImportedMatch[],
  options: { teamName: string; seasonYear?: number; defaultTime?: string },
): ImportedMatch[] {
  const seasonYear = options.seasonYear ?? new Date().getFullYear();
  const defaultTime = options.defaultTime ?? "10:00";
  const cleaned: ImportedMatch[] = [];

  for (const row of rows) {
    const date = normalizeDate(row.date, seasonYear);
    if (!date) continue;
    const time = normalizeTime(row.time);
    const home = cleanText(row.home_team);
    const away = cleanText(row.away_team);
    const missingYear = !/\d{4}/.test(String(row.date ?? ""));
    cleaned.push({
      date,
      time: time ?? defaultTime,
      home_team: home || options.teamName,
      away_team: away,
      location: cleanText(row.location),
      needsReview:
        !time ||
        missingYear ||
        !away ||
        (row.confidence !== null && row.confidence !== undefined && row.confidence < 0.6),
    });
  }

  cleaned.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  return dedupe(cleaned);
}

function keyOf(match: { date: string; time: string }): string {
  return `${match.date} ${match.time}`;
}

function dedupe(matches: ImportedMatch[]): ImportedMatch[] {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = `${keyOf(match)} ${match.away_team.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Tar bort matcher som redan ligger i kalendern på samma dag och tid. */
export function withoutExisting(
  matches: ImportedMatch[],
  existing: { starts_at: string }[],
): ImportedMatch[] {
  const taken = new Set(
    existing.map((event) => {
      const date = new Date(event.starts_at);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
        date.getDate(),
      ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes(),
      ).padStart(2, "0")}`;
    }),
  );
  return matches.filter((match) => !taken.has(keyOf(match)));
}

/** Lokalt datum + tid till ISO, samma regel som formulären använder. */
export function toIsoStart(match: { date: string; time: string }): string | null {
  const [year, month, day] = match.date.split("-").map(Number);
  const [hour, minute] = match.time.split(":").map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) return null;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
