// Service worker for Falcon Dashboard PWA
const CACHE_VERSION = '2';
const CACHE_NAME = `falcon-dash-v${CACHE_VERSION}`;

const APP_SHELL = ['/', '/manifest.json'];

// Install: cache app shell
self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
	self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
			)
	);
	self.clients.claim();
});

// Fetch: network-first for navigation/API, stale-while-revalidate for assets
self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET and cross-origin
	if (request.method !== 'GET' || url.origin !== self.location.origin) return;

	// API calls and WebSocket upgrades: network only
	if (url.pathname.startsWith('/api/') || url.pathname === '/ws') return;

	// Navigation requests: network-first with offline fallback
	if (request.mode === 'navigate') {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
					return response;
				})
				.catch(() => caches.match('/') || new Response('Offline', { status: 503 }))
		);
		return;
	}

	// Static assets (JS, CSS, images, fonts): stale-while-revalidate
	event.respondWith(
		caches.open(CACHE_NAME).then((cache) =>
			cache.match(request).then((cached) => {
				const fetching = fetch(request).then((response) => {
					if (response.ok) cache.put(request, response.clone());
					return response;
				});
				return cached || fetching;
			})
		)
	);
});
