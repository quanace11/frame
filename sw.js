// Frame Studio service worker — version 2026.11.20-1918
const VERSION = '2026.11.20-1918';
const CORE = 'fs-core-' + VERSION, RUNTIME = 'fs-runtime';
const CORE_FILES = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './ort.wasm.min.js', './ort-wasm-simd-threaded.mjs'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CORE).then(c => c.addAll(CORE_FILES))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('fs-core-') && k !== CORE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // the page itself: network first (so updates arrive), fall back to cache when offline
  if (req.mode === 'navigate' || (url.origin === location.origin && (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')))) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(CORE).then(c => c.put('./index.html', cp)); return r; }).catch(() => caches.match('./index.html', { ignoreSearch: true })));
    return;
  }
  // everything else (AI models, wasm, fonts): cache first, saved the first time it is used
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); const big = /migan|u2netp|\.wasm$/.test(url.pathname); caches.open(big ? RUNTIME : CORE).then(c => c.put(req, cp)); }
    return r;
  })));
});
