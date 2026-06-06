// Service Worker — Absensi Digital
// Caching strategy: Cache First untuk statik, Network First untuk lainnya

const CACHE_NAME = 'absensi-digital-v4';
const OFFLINE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  
  // HTML Templates (Lazy Loaded)
  './templates/tab-absen.html',
  './templates/tab-ket.html',
  './templates/tab-profil.html',
  './templates/tab-rekap.html',
  './templates/tab-tugas.html',
  './templates/tab-lembur.html',
  './templates/tab-simapo.html',
  './templates/tab-admin.html',
  
  // Local CSS Libraries
  './css/lib/flatpickr-dark.css',
  './css/lib/leaflet.min.css',
  './css/lib/font-awesome.min.css',
  
  // Leaflet images
  './css/lib/images/marker-icon.png',
  './css/lib/images/marker-icon-2x.png',
  './css/lib/images/marker-shadow.png',
  
  // FontAwesome Webfonts
  './css/webfonts/fa-solid-900.woff2',
  './css/webfonts/fa-solid-900.woff',
  './css/webfonts/fa-solid-900.ttf',
  './css/webfonts/fa-regular-400.woff2',
  './css/webfonts/fa-regular-400.woff',
  './css/webfonts/fa-regular-400.ttf',
  './css/webfonts/fa-brands-400.woff2',
  './css/webfonts/fa-brands-400.woff',
  './css/webfonts/fa-brands-400.ttf',

  // Local JS Libraries
  './js/lib/telegram-web-app.js',
  './js/lib/xlsx.full.min.js',
  './js/lib/jspdf.umd.min.js',
  './js/lib/jspdf.plugin.autotable.min.js',
  './js/lib/leaflet.min.js',
  './js/lib/sweetalert2.all.min.js',
  './js/lib/flatpickr.min.js',

  // Core App Scripts
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
  './js/face.js',
  './js/absen.js',
  './js/keterangan.js',
  './js/log.js',
  './js/rekap.js',
  './js/admin-libur.js',
  './js/admin-lokasi.js',
  './js/admin-pegawai.js',
  './js/admin-log.js',
  './js/admin-mgmt.js',
  './js/weather.js',
  './js/admin-face.js',
  './js/simapo-admin.js',
  './js/simapo-ext.js',
  './js/desktop.js',
  './js/signature.js',
  './js/meja.js',
  './js/rekap-pdf.js',
  './js/tugas_lembur.js',
  './js/simapo.js',
  './js/offline.js',
  './js/meja-handler.js',
  './js/auth.js',
  './js/app.js'
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
  const url = new URL(e.request.url);
  if (url.hostname.includes('mindcloud.my.id') || url.hostname.includes('sumopod.my.id') || url.hostname.includes('n8n')) return;
  if (url.href.startsWith('chrome-extension://')) return;

  // Cek apakah request untuk file statis (JS, CSS, Font, Template HTML)
  const isStatic = url.pathname.match(/\.(js|css|woff2|woff|ttf|png|jpg|jpeg|svg|json|html)$/i);

  if (isStatic) {
    // Cache First for static files
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        // Fetch and put in cache if not found
        return fetch(e.request).then(res => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(e.request, resClone));
          }
          return res;
        });
      }).catch(() => new Response('Offline', { status: 503 }))
    );
  } else {
    // Network First untuk sisanya (seperti halaman root / )
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
  }
});
