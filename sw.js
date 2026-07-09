// ETECHS QA/QC — Service Worker
// IMPORTANT: bump APP_VERSION on every deploy. The cache name is derived from it,
// so a new version wipes the old cache instead of serving stale files forever.
const APP_VERSION = '50';
const CACHE = 'etechs-qaqc-fb-v' + APP_VERSION;

const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);

  // never cache firebase / google APIs
  if (u.hostname.includes('googleapis.com') || u.hostname.includes('gstatic.com') ||
      u.hostname.includes('firebaseio.com') || u.hostname.includes('firebase')) {
    return;
  }

  // NETWORK-FIRST for the app shell so a new deploy is picked up immediately.
  const isShell = e.request.mode === 'navigate' ||
                  u.pathname.endsWith('/') ||
                  u.pathname.endsWith('/index.html');

  if (isShell) {
    e.respondWith(
      fetch(e.request).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp));
        return r;
      }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // stale-while-revalidate for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(r => {
        const cp = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, cp));
        return r;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
