// Mise service worker: the app and its recipe list keep working with no signal,
// so a saved cookbook is still there in the kitchen. Recipe pages themselves live on the chefs' sites.
const CACHE = 'mise-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './data/chefs.json', './data/recipes.json', './icon.svg'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Same-origin requests: answer from cache right away, refresh the copy in the background.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const key = e.request.mode === 'navigate' ? './' : e.request;
    const cached = await cache.match(key, { ignoreSearch: e.request.mode === 'navigate' });
    const fresh = fetch(e.request).then(res => {
      if (res.ok) cache.put(key, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  }));
});
