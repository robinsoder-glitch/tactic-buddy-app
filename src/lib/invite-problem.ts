/**
 * Vad som är fel med en inbjudningslänk – och vad familjen ska göra åt det.
 * Rena beräkningar, inga databasanrop. Texterna är skrivna för en förälder
 * som just klickat på en länk i ett SMS.
 */

import type { InvitePreviewState } from "@/lib/invite-links";

export type InviteProblemKind =
  | "network"
  | "not-found"
  | "expired"
  | "used"
  | "revoked"
  | "archived"
  | "malformed-code"
  | "pasted-url"
  | "empty"
  | "invalid";

export type InviteProblemInfo = {
  kind: InviteProblemKind;
  title: string;
  message: string;
  /** Konkret nästa steg, alltid något familjen själv kan göra. */
  hint: string;
  /** Går det att försöka hämta igen (tillfälligt fel)? */
  canRetry: boolean;
  /** Ska vi erbjuda att skriva in lagkoden för hand? */
  canEnterCode: boolean;
};

/** Sex tecken, bokstäver eller siffror. Samma regel som lagkoden. */
export function isTeamCodeShape(value: string): boolean {
  return /^[A-Za-z0-9]{6}$/.test(value.trim());
}

/**
 * Tittar bara på adressen, innan vi frågar servern. Fångar det vanligaste:
 * halv länk, hel länk inklistrad i fältet, eller kod med fel antal tecken.
 */
export function tokenProblem(token: string | null | undefined): InviteProblemKind | null {
  const raw = (token ?? "").trim();
  if (!raw) return "empty";
  if (/https?:|%2f|\//i.test(raw)) return "pasted-url";
  const code = raw.match(/^kod-(.*)$/i)?.[1];
  if (code != null && !isTeamCodeShape(code)) return "malformed-code";
  return null;
}

/** Nätverksfel ska inte se ut som en trasig länk – det går över. */
export function isNetworkProblem(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return /failed to fetch|networkerror|network request failed|load failed|timeout|ETIMEDOUT/i.test(
    text,
  );
}

const INFO: Record<InviteProblemKind, Omit<InviteProblemInfo, "kind">> = {
  network: {
    title: "Vi når inte laget just nu",
    message:
      "Internet eller vår server svarade inte. Länken är antagligen hel – det här brukar gå över på någon minut.",
    hint: "Tryck på Försök igen. Fungerar det inte, prova igen om en stund eller byt mellan wifi och mobilnät.",
    canRetry: true,
    canEnterCode: false,
  },
  "not-found": {
    title: "Länken hör inte till något lag",
    message:
      "Koden i länken stämmer inte med något lag. Laget kan ha bytt kod, eller så har länken blivit avkortad på vägen.",
    hint: "Be tränaren skicka länken igen, eller skriv in lagkoden du fått här nedanför.",
    canRetry: true,
    canEnterCode: true,
  },
  expired: {
    title: "Länken har gått ut",
    message: "Den här inbjudan var tidsbegränsad och giltighetstiden har passerat.",
    hint: "Be tränaren skicka en ny inbjudan.",
    canRetry: false,
    canEnterCode: true,
  },
  used: {
    title: "Länken är redan använd",
    message:
      "Inbjudan gällde en person och har redan använts. Har du redan skapat konto kan du logga in i stället.",
    hint: "Logga in med ditt konto, eller be tränaren skicka en ny inbjudan.",
    canRetry: false,
    canEnterCode: true,
  },
  revoked: {
    title: "Tränaren har återkallat länken",
    message: "Inbjudan gäller inte längre.",
    hint: "Be tränaren skicka en ny inbjudan.",
    canRetry: false,
    canEnterCode: true,
  },
  archived: {
    title: "Laget tar inte emot nya medlemmar",
    message: "Laget är avslutat eller arkiverat.",
    hint: "Kontrollera med tränaren vilket lag du ska gå med i.",
    canRetry: false,
    canEnterCode: true,
  },
  "malformed-code": {
    title: "Lagkoden i länken ser inte hel ut",
    message:
      "En lagkod är sex tecken med bokstäver och siffror. Koden i adressen har ett annat antal tecken – länken har troligen brutits i meddelandet.",
    hint: "Skriv in de sex tecknen från tränaren här nedanför, eller be om länken igen.",
    canRetry: false,
    canEnterCode: true,
  },
  "pasted-url": {
    title: "Adressen ser dubbel ut",
    message:
      "Det ser ut som att en hel webbadress hamnat inuti länken. Då hittar vi inte laget.",
    hint: "Öppna länken direkt från meddelandet, eller skriv in lagkoden här nedanför.",
    canRetry: false,
    canEnterCode: true,
  },
  empty: {
    title: "Länken saknar kod",
    message: "Adressen innehåller ingen inbjudan, så vi vet inte vilket lag det gäller.",
    hint: "Skriv in lagkoden du fått av tränaren här nedanför.",
    canRetry: false,
    canEnterCode: true,
  },
  invalid: {
    title: "Länken är ogiltig",
    message: "Vi känner inte igen inbjudan. Kontrollera att hela adressen följde med.",
    hint: "Be tränaren skicka länken igen, eller skriv in lagkoden här nedanför.",
    canRetry: true,
    canEnterCode: true,
  },
};

export function inviteProblemInfo(kind: InviteProblemKind): InviteProblemInfo {
  return { kind, ...INFO[kind] };
}

/** Personliga länkar: översätt serverns status till samma beskedsformat. */
export function problemFromPreviewState(state: InvitePreviewState): InviteProblemKind | null {
  if (state === "active") return null;
  return state;
}
