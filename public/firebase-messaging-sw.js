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

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || "New Order";
  const notificationOptions = {
    body: payload.notification?.body || "You have a new order",
    icon: "/vite.svg",
    badge: "/vite.svg",
    tag: "new-order",
    requireInteraction: true,
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
