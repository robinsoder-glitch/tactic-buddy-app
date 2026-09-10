/**
 * Var en inloggad användare ska hamna. Halvfärdiga konton (kontotyp saknas)
 * ska alltid till "Välj kontotyp" – även när de öppnar en skyddad sida direkt
 * via en länk – och sedan tillbaka till sidan de ville åt.
 */
import { safeNextPath } from "./invite-links";

export const ONBOARDING_PATH = "/onboarding";

/** Sidor man aldrig ska skickas tillbaka till efter att kontotypen är vald. */
const NEVER_RETURN = ["/auth", "/onboarding", "/reset-password"];

/** Rensar en önskad returadress: bara interna sidor, aldrig inloggningssidor. */
export function safeReturnPath(value: string | null | undefined): string | null {
  const path = safeNextPath(value ?? null);
  if (!path) return null;
  const clean = path.split("?")[0]?.split("#")[0] ?? path;
  if (NEVER_RETURN.some((blocked) => clean === blocked || clean.startsWith(`${blocked}/`))) {
    return null;
  }
  return path;
}

/** Sant när den skyddade sidan ska bytas mot "Välj kontotyp". */
export function shouldRedirectToOnboarding(pathname: string, needsOnboarding: boolean): boolean {
  if (!needsOnboarding) return false;
  return pathname !== ONBOARDING_PATH && !pathname.startsWith(`${ONBOARDING_PATH}/`);
}

/** Vart man går efter att kontotypen sparats. */
export function destinationAfterSetup(input: {
  returnPath?: string | null;
  teamId?: string | null;
  status?: string | null;
  role: "coach" | "player";
}): { to: string; teamId?: string } {
  const back = safeReturnPath(input.returnPath);
  if (back) return { to: back };
  if (input.status === "pending") return { to: "/" };
  if (input.teamId) return { to: "/team/$teamId", teamId: input.teamId };
  return { to: input.role === "coach" ? "/teams" : "/" };
}
