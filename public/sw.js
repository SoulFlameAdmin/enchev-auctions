/* E&A AUCTIONS PWA — only offline fallback and public brand asset are cached.
   NEVER cache API, login, auction bids, user information or payment pages. */
"use strict";
const CACHE_NAME = "ea-offline-shell-v1";
const CACHE_PREFIX = "ea-offline-shell-";
const OFFLINE_URL = "/offline";
const PUBLIC_SHELL = [OFFLINE_URL, "/brand/ea-2026-app.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PUBLIC_SHELL)));
  // An existing client must explicitly request SKIP_WAITING before takeover.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) =>
        key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always fetch a fresh navigation. No user routes are stored in Cache Storage.
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL);
      return cached || Response.error();
    }),
  );
});
