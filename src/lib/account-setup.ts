import { supabase } from "@/integrations/supabase/client";
import { claimRole, findTeamByCode, joinTeamWithCode, updateProfile } from "./teams";

export type AccountRole = "coach" | "player";
/** Kontotyp så som den lagras: vårdnadshavare är en egen typ, inte en spelare. */
export type AccountKind = "coach" | "player" | "guardian";
/** Två kodtyper: spelarkod för spelare/vårdnadshavare, tränarkod för tränare. */
export type CodeKind = "coach" | "player";

export const TEAM_CODE_LENGTH = 6;
export const SETUP_SCHEMA_VERSION = 1;

export type AccountSetup = {
  role: AccountRole;
  name: string;
  /** Tränare: födelsedatum (18+) */
  birth?: string;
  adultConfirmed?: boolean;
  /** Spelarflöde: kontot ägs av vårdnadshavare */
  isGuardian?: boolean;
  /** Barnets namn när kontot ägs av vårdnadshavare */
  playerName?: string;
  /** Lag- eller tränarkod */
  code?: string;
};

export const MIN_COACH_AGE = 18;
export const MIN_PLAYER_ACCOUNT_AGE = 13;

/** Tydliga svenska felmeddelanden för registreringen. */
export const SETUP_ERRORS = {
  codeLength: "Lagkoden ska vara exakt sex tecken.",
  codeInvalid: "Koden stämmer inte. Kontrollera de sex tecknen med din tränare.",
  codeExpired: "Koden gäller inte längre. Be din tränare om lagets aktuella kod.",
  codeLookupFailed: "Koden kunde inte kontrolleras just nu. Kontrollera din uppkoppling.",
  codeNeedsCoach: "Den koden är en spelarkod. Som tränare behöver du lagets tränarkod.",
  codeNeedsPlayer:
    "Den koden är en tränarkod. Som spelare eller vårdnadshavare behöver du lagets spelarkod.",
  emailTaken: "Det finns redan ett konto med den e-postadressen. Logga in i stället.",
  weakPassword: "Lösenordet måste vara minst 6 tecken.",
} as const;

export function ageAt(birth: string, today = new Date()): number {
  const date = new Date(birth);
  let years = today.getFullYear() - date.getFullYear();
  const months = today.getMonth() - date.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < date.getDate())) years -= 1;
  return years;
}

/** Trimmar och versaliserar koden. Tomt när ingen kod angetts. */
export function normalizeTeamCode(raw?: string | null): string {
  return (raw ?? "").trim().toUpperCase();
}

export function isCompleteTeamCode(raw?: string | null): boolean {
  return normalizeTeamCode(raw).length === TEAM_CODE_LENGTH;
}

/** coach / player / guardian utifrån valen i formuläret. */
export function accountKindOf(setup: AccountSetup): AccountKind {
  if (setup.role === "coach") return "coach";
  return setup.isGuardian ? "guardian" : "player";
}

/** Vilken kodtyp kontotypen kräver. */
export function requiredCodeKind(setup: AccountSetup): CodeKind {
  return setup.role === "coach" ? "coach" : "player";
}

/** Felmeddelande när kodtypen inte passar kontotypen, annars null. */
export function codeKindError(setup: AccountSetup, codeKind: CodeKind | null): string | null {
  if (!codeKind) return null;
  const needed = requiredCodeKind(setup);
  if (codeKind === needed) return null;
  return needed === "coach" ? SETUP_ERRORS.codeNeedsCoach : SETUP_ERRORS.codeNeedsPlayer;
}

/** Returnerar ett felmeddelande på svenska, eller null när uppgifterna räcker. */
export function validateSetup(
  setup: AccountSetup,
  options: { requireCode?: boolean } = {},
): string | null {
  if (!setup.name.trim()) return "Ange ditt namn";

  if (setup.role === "coach") {
    if (!setup.birth) return "Ange ditt födelsedatum";
    if (ageAt(setup.birth) < MIN_COACH_AGE) return "Du måste vara minst 18 år för ett tränarkonto";
    if (!setup.adultConfirmed) return "Du behöver intyga att uppgiften stämmer";
  } else {
    if (setup.isGuardian && !setup.playerName?.trim()) return "Ange spelarens namn";
    if (!setup.isGuardian && setup.birth && ageAt(setup.birth) < MIN_PLAYER_ACCOUNT_AGE) {
      return "Är spelaren under 13 år ska en vårdnadshavare skapa kontot";
    }
  }

  const code = normalizeTeamCode(setup.code);
  if (options.requireCode || code) {
    if (!code) return "Ange lagkoden du fått av din tränare";
    if (code.length !== TEAM_CODE_LENGTH) return SETUP_ERRORS.codeLength;
  }
  return null;
}

/** Vilken roll en kod ger – spelarkoden ger aldrig tränarbehörighet. */
export function roleFromCodeMatch(match: { join_role: string } | null): AccountRole | null {
  if (!match) return null;
  return match.join_role === "coach" ? "coach" : "player";
}

/** Visningsnamnet är alltid personens eget namn – aldrig barnets eller e-posten. */
export function profileDisplayName(setup: AccountSetup): string {
  return setup.name.trim();
}

/** Barnets namn sparas separat för vårdnadshavare. */
export function guardianChildName(setup: AccountSetup): string | null {
  return accountKindOf(setup) === "guardian" ? setup.playerName?.trim() || null : null;
}

/* --------- registreringsunderlag i auth-metadata (localStorage som reserv) --------- */

export type SetupMetadata = {
  schema_version: number;
  account_kind: AccountKind;
  display_name: string;
  birth_date: string | null;
  adult_confirmed: boolean;
  player_name: string | null;
  team_code: string | null;
};

export function setupToMetadata(setup: AccountSetup): SetupMetadata {
  return {
    schema_version: SETUP_SCHEMA_VERSION,
    account_kind: accountKindOf(setup),
    display_name: setup.name.trim(),
    birth_date: setup.birth?.trim() || null,
    adult_confirmed: Boolean(setup.adultConfirmed),
    player_name: guardianChildName(setup),
    team_code: normalizeTeamCode(setup.code) || null,
  };
}

/** Läser tillbaka registreringsunderlaget efter e-postbekräftelse, även på annan enhet. */
export function setupFromMetadata(meta: Record<string, unknown> | null | undefined) {
  if (!meta) return null;
  const kind = meta["account_kind"];
  if (kind !== "coach" && kind !== "player" && kind !== "guardian") return null;
  const name = typeof meta["display_name"] === "string" ? meta["display_name"] : "";
  const setup: AccountSetup = {
    role: kind === "coach" ? "coach" : "player",
    name,
    isGuardian: kind === "guardian",
  };
  const birth = meta["birth_date"];
  if (typeof birth === "string" && birth) setup.birth = birth;
  if (meta["adult_confirmed"] === true) setup.adultConfirmed = true;
  const child = meta["player_name"];
  if (typeof child === "string" && child) setup.playerName = child;
  const code = meta["team_code"];
  if (typeof code === "string" && code) setup.code = normalizeTeamCode(code);
  return setup;
}

/** Nollställer registreringsunderlaget i metadata efter lyckad anslutning. */
export const CLEARED_SETUP_METADATA = {
  schema_version: null,
  account_kind: null,
  birth_date: null,
  adult_confirmed: null,
  player_name: null,
  team_code: null,
};

const STORAGE_KEY = "tt.account-setup";

type StoredSetup = { email: string | null; setup: AccountSetup };

function normalizeEmail(email?: string | null): string | null {
  const value = email?.trim().toLowerCase();
  return value ? value : null;
}

function isAccountSetup(value: unknown): value is AccountSetup {
  const role = (value as AccountSetup | null)?.role;
  return role === "coach" || role === "player";
}

/**
 * Sparar underlaget lokalt som reserv till auth-metadata. Underlaget binds till
 * registreringens e-postadress så att en avbruten registrering aldrig kan
 * tillämpas på ett annat konto som loggar in på samma enhet.
 */
export function storeSetup(setup: AccountSetup, email?: string | null) {
  try {
    const payload: StoredSetup = { email: normalizeEmail(email), setup };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignorera */
  }
}

function parseStoredSetup(): StoredSetup | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSetup> | AccountSetup;
    if (parsed && typeof parsed === "object" && "setup" in parsed) {
      const stored = parsed as StoredSetup;
      if (!isAccountSetup(stored.setup)) return null;
      return { email: normalizeEmail(stored.email), setup: stored.setup };
    }
    // Gammalt format utan e-postbindning används aldrig – risken att träffa
    // fel konto är större än nyttan.
    return null;
  } catch {
    return null;
  }
}

/**
 * Förhandsifyllning (t.ex. i onboarding). Underlag utan e-postadress – till
 * exempel från en Google-registrering – får bara fylla i formulär, aldrig
 * tillämpas automatiskt på ett konto.
 */
export function readSetup(): AccountSetup | null {
  return parseStoredSetup()?.setup ?? null;
}

/**
 * Strikt läsning vid inloggning: underlaget tillämpas bara när lagrad e-post
 * stämmer exakt med det inloggade kontots e-postadress.
 */
export function readSetupForUser(userEmail: string | null | undefined): AccountSetup | null {
  const stored = parseStoredSetup();
  const email = normalizeEmail(userEmail);
  if (!stored || !stored.email || !email) return null;
  return stored.email === email ? stored.setup : null;
}

export type SetupResult = {
  role: AccountKind;
  teamId: string | null;
  teamName: string | null;
  status: "approved" | "pending" | null;
};

/**
 * Sätter profil, roll och eventuell laganslutning för ett nyskapat konto.
 * Fel kodtyp avvisas – det skapas aldrig motsägelsefulla roller.
 */
export async function applyAccountSetup(userId: string, setup: AccountSetup): Promise<SetupResult> {
  const kind = accountKindOf(setup);
  const code = normalizeTeamCode(setup.code);

  if (code && code.length !== TEAM_CODE_LENGTH) throw new Error(SETUP_ERRORS.codeLength);

  if (code) {
    // Kontrollera kodtypen innan något sparas, så att fel kod inte hinner ge en roll.
    const match = await findTeamByCode(code);
    if (!match) throw new Error(SETUP_ERRORS.codeInvalid);
    const mismatch = codeKindError(setup, match.join_role === "coach" ? "coach" : "player");
    if (mismatch) throw new Error(mismatch);
  }

  await updateProfile({
    id: userId,
    display_name: profileDisplayName(setup),
    birth_date: setup.birth || null,
    ...(kind === "coach" ? { is_adult_confirmed: true } : {}),
    guardian_for_name: guardianChildName(setup),
  });

  if (!code) {
    await claimRole(userId, setup.role);
    return { role: kind, teamId: null, teamName: null, status: null };
  }

  const joined = await joinTeamWithCode(code, kind);
  return {
    role: joined.role,
    teamId: joined.teamId,
    teamName: joined.teamName,
    status: joined.status,
  };
}

/**
 * Slutför registreringen efter e-postbekräftelse – underlaget läses i första
 * hand från auth-metadata, så det fungerar även på en annan enhet.
 */
export async function completePendingSetup(user: {
  id: string;
  user_metadata?: Record<string, unknown> | null;
}): Promise<SetupResult | null> {
  const setup = setupFromMetadata(user.user_metadata) ?? readSetup();
  if (!setup) return null;
  const result = await applyAccountSetup(user.id, setup);
  clearSetup();
  await supabase.auth.updateUser({ data: CLEARED_SETUP_METADATA });
  return result;
}
