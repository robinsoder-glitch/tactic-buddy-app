/**
 * Telefonnummer sparas i ett enda standardformat (E.164, t.ex. +46701234567)
 * så att tel:-länkar fungerar överallt. Svenska nummer skrivna med inledande
 * 0 översätts automatiskt till +46. Visningen sker i läsbara grupper.
 */

const MAX_INPUT = 30;

/** Plockar bort allt utom siffror och ett inledande plus. */
function clean(value: string): string {
  const trimmed = value.trim().slice(0, MAX_INPUT);
  const plus = trimmed.startsWith("+") || trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "").replace(/^00/, "");
  return plus ? `+${digits}` : digits;
}

/**
 * Returnerar numret i E.164 eller null om det inte går att tolka.
 * Tomt fält är tillåtet (numret är frivilligt) och ger null.
 */
export function normalizePhone(value: string): string | null {
  const cleaned = clean(value);
  if (!cleaned) return null;
  if (cleaned.startsWith("+")) {
    const digits = cleaned.slice(1);
    if (digits.length < 8 || digits.length > 15) return null;
    if (digits.startsWith("0")) return null;
    return `+${digits}`;
  }
  // Inhemskt svenskt nummer: 0 + 8–12 siffror.
  if (!cleaned.startsWith("0")) return null;
  const national = cleaned.slice(1);
  if (national.length < 7 || national.length > 12) return null;
  return `+46${national}`;
}

/** Felmeddelande på svenska, eller null när numret är giltigt eller tomt. */
export function phoneError(value: string): string | null {
  if (!value.trim()) return null;
  if (/[a-zA-Z]/.test(value)) return "Telefonnumret får bara innehålla siffror.";
  return normalizePhone(value)
    ? null
    : "Skriv ett giltigt telefonnummer, t.ex. 070-123 45 67 eller +46 70 123 45 67.";
}

/** Visningsformat: svenska mobilnummer som 070-123 45 67, övriga grupperade. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const e164 = normalizePhone(value);
  if (!e164) return value;
  if (e164.startsWith("+46")) {
    const national = `0${e164.slice(3)}`;
    if (national.length === 10) {
      return `${national.slice(0, 3)}-${national.slice(3, 6)} ${national.slice(6, 8)} ${national.slice(8)}`;
    }
    return national.replace(/(\d{2,3})(\d{3})(\d+)/, "$1-$2 $3");
  }
  return e164.replace(/(\+\d{2})(\d{2,3})(\d{3})(\d+)/, "$1 $2 $3 $4");
}
