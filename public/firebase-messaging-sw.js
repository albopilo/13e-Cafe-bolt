importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDNvgS_PqEHU3llqHt0XHN30jJgiQWLkdc",
  authDomain: "e-loyalty-12563.firebaseapp.com",
  projectId: "e-loyalty-12563",
  storageBucket: "e-loyalty-12563.appspot.com",
  messagingSenderId: "3887061029",
  appId: "1:3887061029:web:f9c238731d7e6dd5fb47cc",
  measurementId: "G-966P8W06W2",
});

const messaging = firebase.messaging();

// Background push: fires when app is NOT open (or minimized).
// We MUST build the notification here so the user hears the sound.
messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || "New Order";
  const notificationOptions = {
    body: payload.notification?.body || "You have a new order",
    icon: "/vite.svg",
    badge: "/vite.svg",
    tag: "new-order",
    requireInteraction: true,
    renotify: true,
    vibrate: [200, 100, 200, 100, 200, 100, 400],
    data: payload.data || {},
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes("/staff") && "focus" in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow("/staff");
        }
      })
  );
});

// PWA fetch handler — enables installability and offline shell.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache Supabase API calls or edge functions
  if (url.pathname.startsWith("/functions/") || url.pathname.startsWith("/rest/")) {
    return;
  }

  // Navigation requests → serve cached index.html (offline fallback)
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          return networkResponse;
        } catch {
          const cache = await caches.open("cafe13-shell-v1");
          const cached = await cache.match("/index.html");
          return cached || new Response("Offline", { status: 503 });
        }
      })()
    );
    return;
  }

  // Static assets — cache-first
  event.respondWith(
    (async () => {
      const cache = await caches.open("cafe13-assets-v1");
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
          cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        return cached || new Response("", { status: 503 });
      }
    })()
  );
});

// Pre-cache the app shell on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("cafe13-shell-v1").then((cache) =>
      cache.addAll([
        "/",
        "/index.html",
        "/vite.svg",
        "/manifest.json",
      ]).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== "cafe13-shell-v1" && n !== "cafe13-assets-v1")
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});
