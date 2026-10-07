// Offline cache: network-first for app files so updates land immediately, cache fallback at the gym/field.
const CACHE = 'pitchlab-v4';
const ASSETS = [
  './', './index.html', './css/style.css', './manifest.webmanifest', './icon.svg',
  './js/app.js', './js/db.js', './js/seed.js', './js/logic.js', './js/ui.js', './js/derive.js', './js/charts.js', './js/share-canvas.js', './js/sore-alert.js',
  './js/views/home.js', './js/views/train.js', './js/views/care.js', './js/views/food.js', './js/views/stats.js', './js/views/share.js', './js/views/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

// Only touch PITCH LAB's own caches: other apps on the same github.io origin share Cache Storage.
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('pitchlab-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(async () => (await caches.match(e.request, { ignoreSearch: true })) || caches.match('./index.html')),
  );
});
