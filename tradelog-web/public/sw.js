/* TRADELOG service worker: lets the app open with no connection.
 *
 * It only caches the app itself (the page and its scripts, styles and icons).
 * Your trades are never stored here; they live in IndexedDB on the device.
 * Requests to other origins (Supabase) are not touched.
 *
 * Bump VERSION when you change this file so old caches are cleaned up.
 */
const VERSION = "v2";
const CACHE = `tradelog-app-${VERSION}`;
const PRECACHE = ["/", "/manifest.webmanifest", "/icon.svg"];
const NAVIGATION_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
      // Also grab the scripts and styles the home page points at, so the app
      // is complete after one visit even before the page is controlled.
      try {
        const html = await (await cache.match("/")).text();
        const assets = new Set(html.match(/\/_next\/static\/[^"'\\\s)<>]+/g) || []);
        await Promise.all([...assets].map((url) => cache.add(url).catch(() => {})));
      } catch {
        /* the page will send its resource list once it is running */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("tradelog-app-") && n !== CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

// The page tells us which files it loaded, so everything it needs is cached.
self.addEventListener("message", (event) => {
  if (!event.data || event.data.type !== "CACHE_URLS") return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await Promise.all(
        (event.data.urls || [])
          .filter((u) => typeof u === "string" && u.startsWith(self.location.origin))
          .map((u) => cache.add(u).catch(() => {})),
      );
    })(),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// Pages: try the network briefly, otherwise open the saved copy of the app.
// Cache writes go through event.waitUntil so the browser cannot stop the worker
// before a file is fully saved (that would leave a gap when you are offline).
async function navigation(event) {
  const cache = await caches.open(CACHE);
  try {
    const response = await withTimeout(fetch(event.request), NAVIGATION_TIMEOUT_MS);
    if (response && response.ok) event.waitUntil(cache.put("/", response.clone()));
    return response;
  } catch (error) {
    const saved = await cache.match("/");
    if (saved) return saved;
    throw error;
  }
}

// Built files have a hash in their name, so a saved copy never goes stale.
async function cacheFirst(event) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(event.request);
  if (saved) return saved;
  const response = await fetch(event.request);
  if (response && response.ok) event.waitUntil(cache.put(event.request, response.clone()));
  return response;
}

// Everything else from this site: show the saved copy now, refresh it quietly.
async function staleWhileRevalidate(event) {
  const cache = await caches.open(CACHE);
  const saved = await cache.match(event.request);
  const refresh = fetch(event.request)
    .then(async (response) => {
      if (response && response.ok) await cache.put(event.request, response.clone());
      return response;
    })
    .catch(() => null);
  if (saved) {
    event.waitUntil(refresh);
    return saved;
  }
  return (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(navigation(event));
  } else if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(event));
  } else {
    event.respondWith(staleWhileRevalidate(event));
  }
});
