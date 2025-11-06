const CACHE_NAME = "bjj-community-v1";
const urlsToCache = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
];

// Installation
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Caching app shell");
        // Füge URLs einzeln hinzu für bessere Fehlerbehandlung
        return Promise.all(
          urlsToCache.map((url) => {
            return cache.add(url).catch((err) => {
              console.error("[Service Worker] Failed to cache:", url, err);
            });
          })
        );
      })
      .then(() => {
        console.log("[Service Worker] Skip waiting");
        return self.skipWaiting();
      })
  );
});

// Activation
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("[Service Worker] Removing old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("[Service Worker] Claiming clients");
        return self.clients.claim();
      })
  );
});

// Fetch - Vereinfachte Version für iOS
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ignoriere Chrome Extension requests
  if (request.url.startsWith("chrome-extension://")) {
    return;
  }

  // Ignoriere nicht-GET requests
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Für Supabase immer Network First
  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("supabase.io")
  ) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response("Offline - Keine Verbindung zu Supabase", {
          status: 503,
          statusText: "Service Unavailable",
        });
      })
    );
    return;
  }

  // Für externe CDN-Ressourcen (Leaflet, Supabase JS)
  if (
    url.hostname.includes("unpkg.com") ||
    url.hostname.includes("cdn.jsdelivr.net") ||
    url.hostname.includes("cdnjs.cloudflare.com")
  ) {
    event.respondWith(fetch(request).catch(() => caches.match(request)));
    return;
  }

  // Für eigene Ressourcen: Cache First
  event.respondWith(
    caches
      .match(request)
      .then((response) => {
        if (response) {
          return response;
        }

        return fetch(request).then((response) => {
          // Prüfe ob Response gültig ist
          if (
            !response ||
            response.status !== 200 ||
            response.type === "error"
          ) {
            return response;
          }

          // Nur same-origin cachen
          if (url.origin === location.origin) {
            const responseToCache = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseToCache))
              .catch((err) =>
                console.error("[Service Worker] Cache put error:", err)
              );
          }

          return response;
        });
      })
      .catch((err) => {
        console.error("[Service Worker] Fetch error:", err);
        return new Response("Offline", {
          status: 503,
          statusText: "Service Unavailable",
        });
      })
  );
});
