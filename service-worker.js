/* =========================================
   SAFE STUDENT — Service Worker v1.0
   PWA con soporte offline
   ========================================= */

const CACHE_NAME = 'safe-student-v1.0';
const DYNAMIC_CACHE = 'safe-student-dynamic-v1.0';

// Recursos para cachear en instalación
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json'
];

// ─── INSTALACIÓN ───────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Safe Student v1.0...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Cacheando recursos estáticos...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Error en cache:', err))
  );
});

// ─── ACTIVACIÓN ────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Safe Student...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== DYNAMIC_CACHE)
          .map(key => {
            console.log('[SW] Eliminando caché antiguo:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── FETCH — Estrategia Cache First ────────
self.addEventListener('fetch', (event) => {
  // Solo manejar GET
  if (event.request.method !== 'GET') return;

  // Ignorar extensiones de Chrome y otros schemes
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }

        // No está en caché: fetch de red + guardar en caché dinámico
        return fetch(event.request)
          .then(networkResponse => {
            // Solo cachear respuestas válidas
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const responseClone = networkResponse.clone();
              caches.open(DYNAMIC_CACHE).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Sin conexión y no está en caché: retornar página offline
            if (event.request.headers.get('Accept').includes('text/html')) {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// ─── NOTIFICACIONES PUSH ────────────────────
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Tienes un recordatorio pendiente.',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Abrir app' },
      { action: 'close', title: 'Cerrar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'SAFE STUDENT', options)
  );
});

// ─── CLICK EN NOTIFICACIÓN ─────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

// ─── SINCRONIZACIÓN EN BACKGROUND ──────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reportes') {
    event.waitUntil(syncReportesPendientes());
  }
});

async function syncReportesPendientes() {
  console.log('[SW] Sincronizando reportes pendientes...');
  // Aquí iría la lógica de sincronización con servidor
}
