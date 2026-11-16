const CACHE_VERSION = "florika-v5";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.headers.has("range")) return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !/^https?:$/.test(url.protocol)) return;

  event.respondWith(
    fetch(request, { cache: "no-cache" })
      .then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || Response.error()))
  );
});
