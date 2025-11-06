// BJJ Community Service Worker mit Workbox
importScripts(
  "https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js"
);

const CACHE_NAME = "bjj-community-v1";
const offlineFallbackPage = "/offline.html";

// Konfiguriere Workbox
workbox.setConfig({
  debug: false,
});

// Precache wichtige Dateien beim Install
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Caching offline page");
      return cache
        .addAll([
          offlineFallbackPage,
          "/",
          "/index.html",
          "/styles.css",
          "/app.js",
          "/manifest.json",
          "/icons/icon-192x192.png",
          "/icons/icon-512x512.png",
        ])
        .catch((err) => {
          console.error("[Service Worker] Cache addAll error:", err);
        });
    })
  );
  self.skipWaiting();
});

// Aktiviere neuen Service Worker sofort
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[Service Worker] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Message Handler für Skip Waiting
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Navigation Preload aktivieren (wenn unterstützt)
if (workbox.navigationPreload.isSupported()) {
  workbox.navigationPreload.enable();
}

// Caching Strategien

// 1. HTML-Seiten: Network First (immer frische Daten versuchen)
workbox.routing.registerRoute(
  ({ request }) => request.mode === "navigate",
  new workbox.strategies.NetworkFirst({
    cacheName: "pages-cache",
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 Tage
      }),
    ],
  })
);

// 2. CSS & JavaScript: Stale While Revalidate
workbox.routing.registerRoute(
  ({ request }) =>
    request.destination === "style" || request.destination === "script",
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "assets-cache",
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Tage
      }),
    ],
  })
);

// 3. Bilder: Cache First (Bilder ändern sich selten)
workbox.routing.registerRoute(
  ({ request }) => request.destination === "image",
  new workbox.strategies.CacheFirst({
    cacheName: "images-cache",
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 24 * 60 * 60, // 60 Tage
      }),
      new workbox.cacheableResponse.CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// 4. Google Fonts: Stale While Revalidate
workbox.routing.registerRoute(
  ({ url }) =>
    url.origin === "https://fonts.googleapis.com" ||
    url.origin === "https://fonts.gstatic.com",
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "google-fonts-cache",
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 Jahr
      }),
    ],
  })
);

// 5. CDN-Ressourcen (Leaflet, Supabase): Stale While Revalidate
workbox.routing.registerRoute(
  ({ url }) =>
    url.origin === "https://unpkg.com" ||
    url.origin === "https://cdn.jsdelivr.net" ||
    url.origin === "https://cdnjs.cloudflare.com",
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: "cdn-cache",
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Tage
      }),
    ],
  })
);

// 6. Supabase API: Network Only (immer aktuelle Daten)
workbox.routing.registerRoute(
  ({ url }) =>
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("supabase.io"),
  new workbox.strategies.NetworkOnly()
);

// Offline Fallback für Navigation
workbox.routing.setCatchHandler(({ event }) => {
  if (event.request.destination === "document") {
    return caches.match(offlineFallbackPage);
  }
  return Response.error();
});

// Background Sync für zukünftige Features (optional)
if ("sync" in self.registration) {
  console.log("[Service Worker] Background Sync ist verfügbar");
}

console.log("[Service Worker] Loaded successfully");
