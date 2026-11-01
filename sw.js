// Offline shell for Kern Energy Check CRM. Lead data lives in localStorage and syncs to the Sheet.
// This address (brytoncarlson34.github.io) is shared with other apps, like /knockout-forms/ (caches 'kf-*').
// So we only ever touch our own 'kec-crm-*' caches and only answer requests inside our own folder.
const V='kec-crm-v2.3';
const SHELL=['./','index.html','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png'];
const SCOPE=new URL('./',self.location).href; // https://brytoncarlson34.github.io/kec-crm/
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('kec-crm-')&&k!==V).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin||!u.href.startsWith(SCOPE))return; // Sheet calls and other apps go straight to the network
  // network first so updates land, cache when offline (only from our own cache)
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));}return r;})
    .catch(()=>caches.open(V).then(x=>x.match(e.request,{ignoreSearch:true}).then(r=>r||x.match('index.html')).then(r=>r||Response.error()))));
});
