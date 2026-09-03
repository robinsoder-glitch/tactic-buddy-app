/**
 * Etapp 2 – personliga inbjudningslänkar.
 * Rena hjälpfunktioner för hur en inbjudan presenteras och vilka svenska
 * besked användaren får. Ingen databaskontakt här.
 */

export type InvitePreviewState = "active" | "expired" | "used" | "revoked" | "archived" | "invalid";

/** Nyckeln som håller kvar inbjudan genom inloggning och e-postbekräftelse. */
export const PENDING_INVITE_KEY = "fotbollsrummet.pending_invite";

export const INVITE_PREVIEW_MESSAGES: Record<InvitePreviewState, string> = {
  active: "Inbjudan är giltig. Logga in eller skapa ett konto för att gå med.",
  expired: "Länken har gått ut. Be din tränare skicka en ny inbjudan.",
  used: "Länken har redan använts. Be din tränare skicka en ny inbjudan.",
  revoked: "Länken har återkallats av tränaren.",
  archived: "Laget är arkiverat och tar inte emot nya medlemmar.",
  invalid: "Länken är ogiltig. Kontrollera att du kopierade hela adressen.",
};

export function canAcceptInvite(state: InvitePreviewState): boolean {
  return state === "active";
}

export function inviteRoleLabel(role: "coach" | "player" | null | undefined): string {
  if (role === "coach") return "Tränare eller ledare";
  if (role === "player") return "Spelare eller vårdnadshavare";
  return "Medlem";
}

/** Bygger den fullständiga länken som kopieras och kodas i QR-koden. */
export function buildInviteUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/inbjudan/${token}`;
}

/** Länk till inloggning som tar användaren tillbaka till inbjudan efteråt. */
export function inviteAuthPath(token: string, mode: "signin" | "signup"): string {
  const next = encodeURIComponent(`/inbjudan/${token}`);
  return mode === "signup" ? `/auth?mode=signup&next=${next}` : `/auth?next=${next}`;
}

/** Endast interna vägar tillåts som återvändo efter inloggning. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function inviteExpiryText(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "";
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
}

/** Var ansökan kom ifrån, skrivet så en tränare förstår. */
export function joinSourceLabel(value: string | null | undefined): string {
  if (value === "coach_code") return "tränarkod";
  if (value === "player_code") return "spelarkod";
  if (value === "invite_link") return "personlig länk";
  return "okänd väg";
}
