/**
 * Håller reda på hur många navigeringar som skett inuti appen sedan sidan
 * laddades. Först när det finns minst en tidigare vy inuti appen är det
 * säkert att använda webbläsarens bakåtfunktion – annars skulle användaren
 * hamna utanför appen (eller på inloggningssidan).
 */
let internalNavigations = 0;

export function noteInternalNavigation(): void {
  internalNavigations += 1;
}

export function canGoBackInApp(): boolean {
  if (typeof window === "undefined") return false;
  return internalNavigations > 0 && window.history.length > 1;
}

/** Endast för tester. */
export function resetInternalNavigations(): void {
  internalNavigations = 0;
}
