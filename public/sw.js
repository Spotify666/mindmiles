/**
 * MIND MILES — service worker.
 *
 * Two jobs, and the second is the reason this file exists at all.
 *
 *   1. Work offline. Everything Mind Miles knows already lives in this browser,
 *      so there is nothing it genuinely needs a network for. Without a service
 *      worker it still showed a connection error on the underground, which is
 *      absurd for an app whose entire dataset is on the device.
 *
 *   2. Make it installable. Chrome will not fire `beforeinstallprompt` — the
 *      event every "Install app" button depends on — unless a service worker
 *      with a fetch handler is controlling the page. A manifest alone is not
 *      enough, which is why there was no install button to find.
 *
 * It caches the app shell and nothing else. No behavioural data passes through
 * here, and there is no network destination for any to go to.
 */

const VERSION = 'v1';
const SHELL = `mindmiles-shell-${VERSION}`;
const ASSETS = `mindmiles-assets-${VERSION}`;

/** Routes worth having available cold, with no connection at all. */
const PRECACHE = ['/', '/trends', '/challenges', '/profile', '/guide', '/welcome'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // Individually, so one 404 during a deploy cannot fail the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Build output is content-hashed and immutable, so cache-first is safe and
  // makes a cold launch instant.
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(ASSETS).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Pages: network first, so a deploy is picked up immediately, with the cache
  // as the fallback — and the home route as the last resort, which is enough to
  // boot the app since all its data is local anyway.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('/'))),
    );
    return;
  }

  // Everything else same-origin: serve what we have, refresh in the background.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(ASSETS).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
