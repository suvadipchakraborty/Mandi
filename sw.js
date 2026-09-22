/* ============================================================
   Mandi Nibs — sw.js
   Minimal service worker: caches the app shell (HTML/CSS/JS,
   icons, manifest, offline sample data) so the app installs
   cleanly and still opens at the mandi with a weak signal.
   Live mandi prices are deliberately NEVER cached here — that
   fetch is left to pass straight through to the network so
   prices are never served stale from the cache. If that live
   fetch fails, js/data.js already falls back to the bundled
   data/sample_produce.json, which IS precached below.

   Bump CACHE_VERSION whenever a shell file changes so returning
   visitors pick up the update instead of a stale cached copy.
   ============================================================ */

const CACHE_VERSION = "v3";
const CACHE_NAME = `mandi-nibs-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/data.js",
  "./js/shoppingList.js",
  "./js/app.js",
  "./data/sample_produce.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/apple-touch-icon.png"
];

// Hosts whose responses must always come from the network —
// never served from, or written to, the cache.
const NEVER_CACHE_HOSTS = ["docs.google.com", "docs.googleusercontent.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Live mandi price feed: always network, never touch the cache.
  if (NEVER_CACHE_HOSTS.includes(url.hostname)) return;

  // Cross-origin CDN assets (fonts, Tailwind, Chart.js): network-first,
  // fall back to cache if offline, but don't fail the whole page if
  // neither is available.
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Same-origin navigation (the app shell itself): network-first so
  // deployed updates show up immediately, falling back to the cached
  // shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Same-origin static assets: cache-first for instant loads, with a
  // silent background refresh so the cache stays current.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
