/*
 * Fotbollsrummet – service worker.
 *
 * Version 1: endast läsning offline. Ingen kö skickar svar, meddelanden eller
 * närvaro i efterhand – det kräver ett eget beslut om konflikthantering.
 */
const VERSION = "v3";
const SHELL_CACHE = `fr-shell-${VERSION}`;
const ASSET_CACHE = `fr-assets-${VERSION}`;
const PAGE_CACHE = `fr-pages-${VERSION}`;
const CURRENT = [SHELL_CACHE, ASSET_CACHE, PAGE_CACHE];

const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

/** Sidor som aldrig får ligga kvar i cache (känsligt innehåll). */
const NEVER_CACHE = [
  "/admin",
  "/auth",
  "/onboarding",
  "/installningar",
  "/inbjudan",
  "/tranarsnack",
  "/spelare",
];

function isPrivatePath(pathname) {
  return NEVER_CACHE.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !CURRENT.includes(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "CLEAR_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    );
  }
  if (data.type === "SKIP_WAITING") self.skipWaiting();
});

async function networkFirstPage(request) {
  const url = new URL(request.url);
  try {
    const response = await fetch(request);
    if (response.ok && !isPrivatePath(url.pathname)) {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const shell = await caches.match("/");
    if (shell) return shell;
    throw error;
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(ASSET_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // API-, auth- och datasvar cachelagras aldrig av service workern.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  const dest = request.destination;
  if (dest === "style" || dest === "script" || dest === "font" || dest === "image") {
    event.respondWith(cacheFirstAsset(request));
  }
});
