// Offline shell for the multi-trade CRM. Leads live in localStorage; solar syncs to its Sheet, forms to the shop backend.
// The address may be shared with other apps (kec-crm-*, kf-* caches), so we only touch our own 'mt-' caches
// and only answer requests inside our own folder. Backend calls (/exec) always go to the network.
const V = 'mt-v1.0.1';
const SHELL = ['./', 'index.html', 'config.js', 'jspdf.umd.min.js', 'pdf.js', 'pdfjs.min.js', 'pdfjs.worker.min.js', 'logo.png', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/kec-180.png', 'icons/ko-180.png', 'icons/app-192.png', 'icons/app-512.png'];
const SCOPE = new URL('./', self.location).href;
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('mt-') && k !== V).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || !u.href.startsWith(SCOPE) || u.pathname.endsWith('/exec')) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.open(V).then(x => x.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? x.match('index.html') : undefined)).then(r => r || Response.error()))));
});
