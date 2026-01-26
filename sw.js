/* sw.js — Compromisos (v2) */

const CACHE_NAME = "compromisos-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./compromisos.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./compromisos.css",
  "./compromisos.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k.startsWith("compromisos-") && k !== CACHE_NAME)
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

/**
 * Estrategia:
 * - HTML/CSS/JS (mismo origen): NETWORK-FIRST (para evitar versiones antiguas)
 * - Resto: CACHE-FIRST
 */
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo controlamos mismo origen
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === "navigate" || url.pathname.endsWith(".html") || url.pathname.endsWith("/");
  const isCSS = url.pathname.endsWith(".css");
  const isJS  = url.pathname.endsWith(".js");

  if (isHTML || isCSS || isJS) {
    event.respondWith(networkFirst(req));
    return;
  }

  event.respondWith(cacheFirst(req));
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await fetch(req);
    // Guardamos copia
    cache.put(req, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await cache.match(req);
    if (cached) return cached;
    // Último recurso: intentar raíz si es navegación
    if (req.mode === "navigate") {
      const fallback = await cache.match("./index.html") || await cache.match("./compromisos.html");
      if (fallback) return fallback;
    }
    throw e;
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);
  if (cached) return cached;

  const fresh = await fetch(req);
  cache.put(req, fresh.clone());
  return fresh;
}