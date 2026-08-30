declare const __BUILD_ID__: string;

export const BUILD_ID: string =
  typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "unknown";

export const BUILD_MODE: string = import.meta.env.MODE;

const STORAGE_KEY = "app_build_id";
const RELOAD_KEY = "app_chunk_reload_at";

/** Reload the page while defeating any cached module chunk / HTML. */
export async function hardReload(): Promise<void> {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  const url = new URL(window.location.href);
  url.searchParams.set("v", Date.now().toString(36));
  window.location.replace(url.toString());
}

/**
 * If the deployed build id differs from the one this tab booted with,
 * the tab is holding stale chunks — reload once (guarded against loops).
 */
export function checkBuildVersion(): boolean {
  try {
    const prev = localStorage.getItem(STORAGE_KEY);
    if (prev && prev !== BUILD_ID) {
      localStorage.setItem(STORAGE_KEY, BUILD_ID);
      return true;
    }
    localStorage.setItem(STORAGE_KEY, BUILD_ID);
  } catch {
    /* ignore */
  }
  return false;
}

/** Returns true if we may auto-reload (not more than once per 15 s). */
export function canAutoReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < 15000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
  return true;
}

export function isChunkLoadError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("importing a module script failed") ||
    m.includes("failed to fetch dynamically imported module") ||
    m.includes("error loading dynamically imported module") ||
    m.includes("'text/html' is not a valid javascript mime type") ||
    m.includes("unexpected token '<'") ||
    m.includes("chunkloaderror")
  );
}

/** Latest loaded JS chunk (name + hash) as seen by the browser. */
export function latestChunk(): { name: string; hash: string } | null {
  try {
    const entries = performance
      .getEntriesByType("resource")
      .filter((e) => /\.(m?js)(\?|$)/.test(e.name))
      .sort((a, b) => b.startTime - a.startTime);
    const last = entries[0];
    if (!last) return null;
    const file = last.name.split("/").pop() ?? last.name;
    const hash = file.match(/[-.]([A-Za-z0-9_]{6,12})\.m?js/)?.[1] ?? "—";
    return { name: file, hash };
  } catch {
    return null;
  }
}

/**
 * Signatur för den version som servern levererar just nu: namnen på
 * inlästa skript i index.html. Ändras signaturen finns en ny version.
 */
export async function fetchDeployedSignature(): Promise<string | null> {
  try {
    const response = await fetch(`/?v=${Date.now().toString(36)}`, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!response.ok) return null;
    const html = await response.text();
    const scripts = Array.from(html.matchAll(/(?:src|href)="([^"]+\.m?js)"/g)).map((m) => m[1]);
    if (scripts.length === 0) return null;
    return scripts.sort().join("|");
  } catch {
    return null;
  }
}
