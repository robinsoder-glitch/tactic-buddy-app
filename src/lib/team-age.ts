/**
 * Yngre lag (spelare under 12 år) har bara vårdnadshavarkonton. Barnen får
 * aldrig egna konton – all information går via vårdnadshavaren.
 *
 * Laget kan sätta inställningen själv (`guardian_only`). Är den inte satt
 * härleds den ur åldersgruppen, t.ex. "P2015" eller "F 2016".
 */

export const YOUTH_AGE_LIMIT = 12;

export type TeamAgeInput = {
  age_group?: string | null;
  guardian_only?: boolean | null;
};

/** Plockar ut födelseåret ur en åldersgrupp, t.ex. "P2015" → 2015. */
export function birthYearFromAgeGroup(ageGroup: string | null | undefined): number | null {
  if (!ageGroup) return null;
  const match = ageGroup.match(/(19|20)\d{2}/);
  if (!match) return null;
  const year = Number(match[0]);
  return Number.isFinite(year) ? year : null;
}

/** Ungefärlig ålder under året laget spelar. */
export function ageFromAgeGroup(
  ageGroup: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const year = birthYearFromAgeGroup(ageGroup);
  return year == null ? null : now.getFullYear() - year;
}

/** Sant när laget bara ska ha vårdnadshavarkonton. */
export function isGuardianOnlyTeam(team: TeamAgeInput | null | undefined, now?: Date): boolean {
  if (!team) return false;
  if (team.guardian_only != null) return team.guardian_only;
  const age = ageFromAgeGroup(team.age_group, now);
  return age != null && age < YOUTH_AGE_LIMIT;
}

/** Kort förklaring som visas för tränaren på lagets översikt. */
export function guardianOnlyExplanation(guardianOnly: boolean): string {
  return guardianOnly
    ? "Laget har bara vårdnadshavarkonton. Barnen behöver inga egna konton – kallelser går till vårdnadshavaren."
    : "Laget kan ha både spelarkonton och vårdnadshavarkonton.";
}
