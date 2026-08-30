/**
 * Dataminimering för barnuppgifter. Vi sparar hellre födelseår än exakt
 * födelsedatum, och foto är alltid frivilligt.
 */

export const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "Vill inte ange" },
  { value: "boy", label: "Pojke" },
  { value: "girl", label: "Flicka" },
];

export const PHOTO_CONSENT_TEXT =
  "Foto är frivilligt. Bilden visas bara för lagets ledare och godkända medlemmar, aldrig publikt. Du tar bort bilden genom att redigera spelaren och välja Ta bort bild.";

const YEAR = /^\d{4}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Läser ut födelseår ur ett sparat värde (datum eller år). */
export function birthYearOf(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 4);
}

/** Sant om det sparade värdet innehåller ett exakt datum (inte 1 januari-platshållaren). */
export function hasExactBirthDate(value: string | null | undefined): boolean {
  if (!value || !DATE.test(value)) return false;
  return !value.endsWith("-01-01");
}

/**
 * Gör om formulärets värden till det som sparas.
 * Ett år lagras som "ÅÅÅÅ-01-01" så att befintlig kolumn kan återanvändas.
 */
export function toStoredBirth(input: { year: string; exactDate?: string | null; useExact?: boolean }): string | null {
  if (input.useExact && input.exactDate && DATE.test(input.exactDate)) return input.exactDate;
  const year = input.year.trim();
  if (!YEAR.test(year)) return null;
  const numeric = Number(year);
  const now = new Date().getFullYear();
  if (numeric < 1900 || numeric > now) return null;
  return `${year}-01-01`;
}

/** Visningstext: exakt datum om vi har det, annars bara födelseår. */
export function birthLabel(value: string | null | undefined): string {
  if (!value) return "";
  if (hasExactBirthDate(value)) return value;
  const year = birthYearOf(value);
  return year ? `Födelseår ${year}` : "";
}

export function ageFromBirth(value: string | null | undefined, today = new Date()): number | null {
  const year = Number(birthYearOf(value));
  if (!year) return null;
  if (hasExactBirthDate(value)) {
    const date = new Date(value as string);
    let age = today.getFullYear() - date.getFullYear();
    const before =
      today.getMonth() < date.getMonth() ||
      (today.getMonth() === date.getMonth() && today.getDate() < date.getDate());
    if (before) age -= 1;
    return age;
  }
  return today.getFullYear() - year;
}
