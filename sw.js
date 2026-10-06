// Service Worker Oficial de Plaza Megatón PWA
const CACHE_NAME = 'megaton-pwa-v4';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/assets/logo-megaton.svg',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/manifest.json'
];

// Instalación: Guardar recursos esenciales en caché
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS).catch(err => {
        console.warn('[SW] Algunos recursos iniciales no pudieron cachearse:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activación: Reclamar clientes y limpiar cachés antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Estrategia Network-First con Fallback a Caché (garantiza datos siempre frescos)
self.addEventListener('fetch', event => {
  // Solo interceptar peticiones GET dentro del mismo origen
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // No interceptar llamadas API dinámicas para que siempre vayan al servidor
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clonar respuesta válida a la caché
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Si no hay internet, responder desde caché
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Manejo de Notificaciones Push (Web Push)
self.addEventListener('push', event => {
  let data = { title: 'Plaza Megatón', body: 'Tiene una nueva comunicación de la Administración.', url: '/novedades.html?tab=mensajes' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (_) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/novedades.html?tab=mensajes' }
  };

  // Actualizar insignia en icono de la app si está disponible
  if ('setAppBadge' in self.navigator) {
    self.navigator.setAppBadge(data.unreadCount || 1).catch(() => {});
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Plaza Megatón', options)
  );
});

// Clic en notificación: abrir o enfocar la aplicación
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) 
    ? event.notification.data.url 
    : '/novedades.html?tab=mensajes';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('novedades.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Mensajería entre la página y el Service Worker para App Badging
self.addEventListener('message', event => {
  if (!event.data) return;
  if (event.data.type === 'SET_BADGE') {
    const count = event.data.count || 0;
    if ('setAppBadge' in self.navigator) {
      if (count > 0) {
        self.navigator.setAppBadge(count).catch(() => {});
      } else {
        self.navigator.clearAppBadge().catch(() => {});
      }
    }
  } else if (event.data.type === 'CLEAR_BADGE') {
    if ('clearAppBadge' in self.navigator) {
      self.navigator.clearAppBadge().catch(() => {});
    }
  }
});
