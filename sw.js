/* sw.js — Service Worker básico para PWA Compromisos (offline + cache) */
"use strict";

const CACHE_VERSION = "compromisos-pwa-v1";
const APP_SHELL = [
  "./",
  "./compromisos.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

// Instalación: precache del “app shell”
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    // cache.addAll falla si algún recurso no existe (p.ej. iconos).
    // Por eso lo hacemos “best effort”.
    await Promise.all(APP_SHELL.map(async (url) => {
      try { await cache.add(url); } catch (e) { /* ignore */ }
    }));
    await self.skipWaiting();
  })());
});

// Activación: limpiar caches antiguas
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_VERSION ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

// Fetch: cache-first para recursos, network-fallback
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Solo manejamos mismo origen
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    // Navegaciones: intenta red, si falla sirve el HTML principal (offline)
    if (req.mode === "navigate") {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put("./compromisos.html", fresh.clone()).catch(() => {});
        return fresh;
      } catch (e) {
        const cached = await caches.match("./compromisos.html");
        return cached || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    }

    // Recursos: cache-first
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      // Cachea recursos estáticos “razonables”
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, fresh.clone()).catch(() => {});
      return fresh;
    } catch (e) {
      return new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});
