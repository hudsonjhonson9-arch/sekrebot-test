// Service Worker — Absensi BAPPERIDA
// Caching strategy: Network First, offline fallback ke cache

const CACHE_NAME = 'absensi-bapperida-v1';
const OFFLINE_ASSETS = [
  './',
  './index.html',
  './css/styles.css',
  './js/config.js',
  './js/constants.js',
  './js/state.js',
  './js/errors.js',
  './js/dom.js',
  './js/api.js',
  './js/ui.js',
  './js/helpers.js',
  './js/network.js',
  './js/profil.js',
  './js/absen.js',
  './js/keterangan.js',
  './js/log.js',
  './js/rekap.js',
  './js/auth.js',
  './js/app.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(OFFLINE_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Cache install error:', err))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Skip non-GET, chrome-extension, dan API calls ke n8n
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('mindcloud.my.id') || url.includes('sumopod.my.id') || url.includes('n8n')) return;
  if (url.startsWith('chrome-extension://')) return;

  // Network-first untuk semua request
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, resClone));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(cached => cached || new Response('Offline', { status: 503 })))
  );
});
