// A service worker exists only so browsers offer "Install app". It caches
// nothing and keeps nothing: every request of the app's own goes straight to
// the server. Requests to anywhere else (the update check) are left to the
// browser, so the page's content policy applies to them.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request));
});
