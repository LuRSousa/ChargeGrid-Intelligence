

const CACHE_NAME = 'chargegrid-cliente-v1';
const APP_SHELL = [
  './login.html',
  './menu.html',
  './style/style-login.css',
  './style/style-menu.css',
  './script/script-login.js',
  './script/script-menu.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];


self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});


self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(
        nomes
          .filter((nome) => nome !== CACHE_NAME)
          .map((nome) => caches.delete(nome))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);


  if (url.pathname.startsWith('/api') || url.port === '3000') {
    event.respondWith(fetch(request).catch(() =>
      new Response(
        JSON.stringify({ sucesso: false, mensagem: 'Sem conexão com o servidor.' }),
        { headers: { 'Content-Type': 'application/json' }, status: 503 }
      )
    ));
    return;
  }


  if (url.origin !== self.location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((resp) => {
            if (resp && resp.status === 200) cache.put(request, resp.clone());
            return resp;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((resp) => {
          if (resp && resp.status === 200) {
            const copia = resp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          }
          return resp;
        })
        .catch(() => cached || caches.match('./menu.html'));
      return cached || fetchPromise;
    })
  );
});
