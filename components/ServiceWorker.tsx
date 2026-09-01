'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker.
 *
 * Beyond working offline, this is what makes the app installable at all —
 * Chrome will not fire `beforeinstallprompt` without a service worker
 * controlling the page.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    // Registered after load so it never competes with the first paint.
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Blocked by browser settings, or an insecure origin. The app is
        // perfectly usable without it; only installing and offline are lost.
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
