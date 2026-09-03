/**
 * Enkel offline-cache för läsning. Endast uppgifter som användaren redan har
 * rätt att se sparas, alltid separerat per inloggad användare och versionsmärkt
 * så att gammal struktur aldrig krockar med en ny appversion.
 */
export const CACHE_VERSION = 3;
const PREFIX = "fr:offline";

/** Enbart dessa datamängder får cachelagras. */
export const ALLOWED_SCOPES = ["upcoming", "invitations", "session-plan"] as const;
export type CacheScope = (typeof ALLOWED_SCOPES)[number];

export type CacheEnvelope<T> = {
  version: number;
  userId: string;
  scope: CacheScope;
  savedAt: string;
  data: T;
};

export function cacheKey(userId: string, scope: CacheScope): string {
  return `${PREFIX}:${CACHE_VERSION}:${userId}:${scope}`;
}

function storage(): Storage | null {
  try {
    const store = (globalThis as { localStorage?: Storage }).localStorage;
    return store ?? null;
  } catch {
    return null;
  }
}

export function writeCache<T>(userId: string, scope: CacheScope, data: T): void {
  const store = storage();
  if (!store || !userId || !ALLOWED_SCOPES.includes(scope)) return;
  const envelope: CacheEnvelope<T> = {
    version: CACHE_VERSION,
    userId,
    scope,
    savedAt: new Date().toISOString(),
    data,
  };
  try {
    store.setItem(cacheKey(userId, scope), JSON.stringify(envelope));
  } catch {
    /* full lagring – hoppa över */
  }
}

export function readCache<T>(userId: string, scope: CacheScope): CacheEnvelope<T> | null {
  const store = storage();
  if (!store || !userId) return null;
  try {
    const raw = store.getItem(cacheKey(userId, scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (parsed.version !== CACHE_VERSION) return null;
    if (parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Rensar all offlinedata. Körs vid utloggning och när kontot byts. */
export function clearOfflineData(): void {
  const store = storage();
  if (store) {
    const keys: string[] = [];
    for (let index = 0; index < store.length; index += 1) {
      const key = store.key(index);
      if (key && key.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  }
  if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "CLEAR_CACHES" });
  }
  if (typeof caches !== "undefined") {
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => undefined);
  }
}

/** Rensar cache som tillhör en annan användare än den inloggade. */
export function clearOtherUsers(currentUserId: string): void {
  const store = storage();
  if (!store) return;
  const keys: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key && key.startsWith(PREFIX) && !key.includes(`:${currentUserId}:`)) keys.push(key);
  }
  keys.forEach((key) => store.removeItem(key));
}

export function savedAtLabel(savedAt: string | null | undefined): string {
  if (!savedAt) return "";
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  }).format(date);
}
