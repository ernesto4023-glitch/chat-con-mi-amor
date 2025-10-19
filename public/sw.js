// sw.js 💞 Manejo de caché y notificaciones push

const CACHE_NAME = "chat-amor-v1";
const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/whatsapp-message-sound-effect-1-386093.mp3"
];

// 📦 Instalar y cachear archivos para modo offline
self.addEventListener("install", (event) => {
  console.log("💞 Service Worker instalado");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// ♻️ Activar y limpiar cachés antiguos
self.addEventListener("activate", (event) => {
  console.log("💫 Service Worker activo");
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 🌐 Interceptar peticiones (modo offline)
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// 🔔 Mostrar notificación push cuando llega un mensaje (desde servidor)
self.addEventListener("push", (event) => {
  console.log("📩 Notificación push recibida:", event.data?.text());
  const data = event.data ? event.data.json() : {};

  const title = data.title || "💌 Nuevo mensaje";
  const options = {
    body: data.body || "Tienes un nuevo mensaje en el Chat de Amor 💞",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    data: { url: "/" }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// 🔗 Cuando el usuario toca la notificación, abrir el chat
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientsArr) => {
      for (const client of clientsArr) {
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});
