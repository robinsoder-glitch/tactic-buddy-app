import { claimRole, joinTeamWithCode, updateProfile } from "./teams";

export type AccountRole = "coach" | "player";

export type AccountSetup = {
  role: AccountRole;
  name: string;
  /** Tränare: födelsedatum (18+) */
  birth?: string;
  adultConfirmed?: boolean;
  /** Spelarflöde: kontot ägs av vårdnadshavare */
  isGuardian?: boolean;
  /** Spelarens namn när kontot ägs av vårdnadshavare */
  playerName?: string;
  /** Lag- eller tränarkod */
  code?: string;
};

export const MIN_COACH_AGE = 18;
export const MIN_PLAYER_ACCOUNT_AGE = 13;

export function ageAt(birth: string, today = new Date()): number {
  const date = new Date(birth);
  let years = today.getFullYear() - date.getFullYear();
  const months = today.getMonth() - date.getMonth();
  if (months < 0 || (months === 0 && today.getDate() < date.getDate())) years -= 1;
  return years;
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
    return null;
  }

  if (setup.isGuardian && !setup.playerName?.trim()) return "Ange spelarens namn";
  if (!setup.isGuardian && setup.birth && ageAt(setup.birth) < MIN_PLAYER_ACCOUNT_AGE) {
    return "Är spelaren under 13 år ska en vårdnadshavare skapa kontot";
  }
  if (options.requireCode && !setup.code?.trim()) return "Ange lagkoden du fått av din tränare";
  return null;
}

/** Vilken roll en kod ger – spelarkoden ger aldrig tränarbehörighet. */
export function roleFromCodeMatch(match: { join_role: string } | null): AccountRole | null {
  if (!match) return null;
  return match.join_role === "coach" ? "coach" : "player";
}

export function profileDisplayName(setup: AccountSetup): string {
  if (setup.role === "player" && setup.isGuardian && setup.playerName?.trim()) {
    return `${setup.name.trim()} (vårdnadshavare för ${setup.playerName.trim()})`;
  }
  return setup.name.trim();
}

const STORAGE_KEY = "tt.account-setup";

export function storeSetup(setup: AccountSetup) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
  } catch {
    /* ignorera */
  }
}

export function readSetup(): AccountSetup | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AccountSetup;
    if (parsed?.role !== "coach" && parsed?.role !== "player") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSetup() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorera */
  }
}

export type SetupResult = {
  role: AccountRole;
  teamId: string | null;
  teamName: string | null;
  status: "approved" | "pending" | null;
};

/** Sätter profil, roll och eventuell laganslutning för ett nyskapat konto. */
export async function applyAccountSetup(userId: string, setup: AccountSetup): Promise<SetupResult> {
  await updateProfile({
    id: userId,
    display_name: profileDisplayName(setup),
    birth_date: setup.birth || null,
    ...(setup.role === "coach" ? { is_adult_confirmed: true } : {}),
    guardian_for_name:
      setup.role === "player" && setup.isGuardian ? (setup.playerName?.trim() ?? null) : null,
  });

  const code = setup.code?.trim();
  if (!code) {
    await claimRole(userId, setup.role);
    return { role: setup.role, teamId: null, teamName: null, status: null };
  }

  const joined = await joinTeamWithCode(code);
  // Koden avgör rollen – en spelarkod kan aldrig ge tränarbehörighet.
  if (joined.role !== setup.role) await claimRole(userId, setup.role);
  return {
    role: joined.role,
    teamId: joined.teamId,
    teamName: joined.teamName,
    status: joined.status,
  };
}
