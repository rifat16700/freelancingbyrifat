const CACHE_NAME = 'fbr-offline-v1';
const OFFLINE_URL = '/offline.html';

// Assets to precache for offline display
const PRECACHE_ASSETS = [
    OFFLINE_URL,
    '/assets/css/premium-icons.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_ASSETS);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // We only care about HTML requests for the offline fallback
    if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html'))) {
        
        // If explicitly asking for the offline page, deliver it immediately from cache
        if (event.request.url.includes(OFFLINE_URL)) {
            event.respondWith(
                caches.match(OFFLINE_URL).then(res => res || fetch(event.request))
            );
            return;
        }

        event.respondWith(
            fetch(event.request).catch((error) => {
                // If network fails on any HTML page, return the cached offline page
                return caches.match(OFFLINE_URL).then((response) => {
                    return response || new Response('Offline Page Missing', { status: 503, statusText: 'Service Unavailable' });
                });
            })
        );
    } else {
        // Non-HTML requests (images, css, js) -> Try network, then cache (or vice-versa depending on strategy)
        // For standard offline resilience of icons/CSS, try network falling back to cache
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
    }
});
