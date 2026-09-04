export type AuthMode = "signin" | "signup";

export type AuthSearch = { mode?: "signup" | undefined; next?: string | undefined };

/** Läget styrs av URL:en så att omladdning och bakåtknappen fungerar. */
export function authModeFromSearch(mode: unknown): AuthMode {
  return mode === "signup" ? "signup" : "signin";
}

/** Bygger nya sökparametrar för valt läge – `mode=signup` tas bort vid inloggning. */
export function authSearchForMode(prev: AuthSearch, next: AuthMode): AuthSearch {
  const base: AuthSearch = {};
  if (typeof prev.next === "string" && prev.next.length > 0) base.next = prev.next;
  if (next === "signup") base.mode = "signup";
  return base;
}
