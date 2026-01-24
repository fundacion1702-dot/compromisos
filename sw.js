/* sw.js — Compromisos (PWA) */
(() => {
  "use strict";

  // ✅ Sube esta versión cuando cambies archivos para forzar actualización de caché
  const VERSION = "compromisos-sw-v1.0.1";
  const STATIC_CACHE = `static-${VERSION}`;
  const RUNTIME_CACHE = `runtime-${VERSION}`;

  // Página “principal” para fallback offline
  const APP_SHELL = "./compromisos.html";

  // Archivos base a cachear
  const PRECACHE_URLS = [
    "./",
    APP_SHELL,
    "./manifest.webmanifest",
    "./icon-192.png",
    "./icon-512.png",
    "./sw.js"
  ];

  self.addEventListener("install", (event) => {
    event.waitUntil((async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(PRECACHE_URLS.map(u => new Request(u, { cache: "reload" })));
      self.skipWaiting();
    })());
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(k => (k.startsWith("static-") || k.startsWith("runtime-")) && k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map(k => caches.delete(k))
      );
      self.clients.claim();
    })());
  });

  self.addEventListener("message", (event) => {
    const msg = event.data;
    if (!msg) return;
    if (msg === "SKIP_WAITING" || (msg && msg.type === "SKIP_WAITING")) {
      self.skipWaiting();
    }
  });

  function isNavigationRequest(request) {
    return request.mode === "navigate" ||
      (request.method === "GET" &&
       request.headers.get("accept") &&
       request.headers.get("accept").includes("text/html"));
  }

  async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const res = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, res.clone());
    return res;
  }

  async function networkFirst(request) {
    const cache = await caches.open(RUNTIME_CACHE);
    try {
      const res = await fetch(request);
      cache.put(request, res.clone());
      return res;
    } catch (e) {
      const cached = await cache.match(request) || await caches.match(request);
      if (cached) return cached;
      return caches.match(APP_SHELL);
    }
  }

  self.addEventListener("fetch", (event) => {
    const req = event.request;
    if (req.method !== "GET") return;

    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    // HTML → network-first
    if (isNavigationRequest(req)) {
      event.respondWith(networkFirst(req));
      return;
    }

    // Assets → cache-first
    const isStaticAsset =
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".jpg") ||
      url.pathname.endsWith(".jpeg") ||
      url.pathname.endsWith(".webp") ||
      url.pathname.endsWith(".svg") ||
      url.pathname.endsWith(".ico") ||
      url.pathname.endsWith(".webmanifest") ||
      url.pathname.endsWith(".json");

    if (isStaticAsset) {
      event.respondWith(cacheFirst(req));
      return;
    }

    event.respondWith(networkFirst(req));
  });
})();