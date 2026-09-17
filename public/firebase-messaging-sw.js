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

// Firebase SDK background handler (secondary — the raw push handler below is primary)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "New Order";
  const body = payload.notification?.body || "You have a new order";
  self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "new-order",
    requireInteraction: true,
    renotify: true,
    vibrate: [200, 100, 200, 100, 200, 100, 400],
    data: { url: "/staff", ...(payload.data || {}) },
  });
});

// Raw push event handler — this is the CRITICAL one.
// It fires even if Firebase CDN scripts failed to load, and gives us
// full control over notification display. This is what makes notifications
// work when the app is completely closed.
self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    try {
      payload = { notification: { title: "New Order", body: event.data ? event.data.text() : "You have a new order" } };
    } catch {
      payload = { notification: { title: "New Order", body: "You have a new order" } };
    }
  }

  // Support both "notification" and "data" payload styles
  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || "New Order!";
  const body = notification.body || data.body || "You have a new order";

  const options = {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "new-order",
    requireInteraction: true,
    renotify: true,
    vibrate: [200, 100, 200, 100, 200, 100, 400],
    data: { url: data.url || "/staff", ...data },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/staff";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && "focus" in client) {
            return client.focus();
          }
        }
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            return client.navigate(targetUrl);
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
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
          const cache = await caches.open("cafe13-shell-v2");
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
      const cache = await caches.open("cafe13-assets-v2");
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
    caches.open("cafe13-shell-v2").then((cache) =>
      cache.addAll([
        "/",
        "/index.html",
        "/manifest.json",
        "/icon-192.png",
        "/icon-512.png",
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
          .filter((n) => n !== "cafe13-shell-v2" && n !== "cafe13-assets-v2")
          .map((n) => caches.delete(n))
      )
    )
  );
  self.clients.claim();
});
