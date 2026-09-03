/**
 * Avgör om det finns en föregående sida *inuti appen* att gå tillbaka till.
 *
 * Routern numrerar varje historikpost. Genom att spara numret för den sida
 * användaren landade på vet vi om hen har navigerat vidare inuti appen eller
 * kom direkt hit (via länk, bokmärke eller omladdning). Bara i det första
 * fallet är webbläsarens bakåtfunktion rätt – annars ska tillbaka-knappen gå
 * till sidans definierade föräldervy.
 */
let landingIndex: number | null = null;

function currentIndex(): number {
  if (typeof window === "undefined") return 0;
  const state = window.history.state as Record<string, unknown> | null;
  const raw = state?.["__TSR_index"] ?? state?.["index"];
  return typeof raw === "number" ? raw : 0;
}

/** Anropas vid varje slutförd navigering; första gången sätter startpunkten. */
export function noteInternalNavigation(): void {
  if (landingIndex === null) landingIndex = currentIndex();
}

export function canGoBackInApp(): boolean {
  if (typeof window === "undefined") return false;
  if (landingIndex === null) return false;
  return currentIndex() > landingIndex;
}

/** Endast för tester. */
export function resetInternalNavigations(): void {
  landingIndex = null;
}
