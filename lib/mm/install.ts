'use client';

/**
 * INSTALLING MIND MILES.
 *
 * A daily instrument belongs on a home screen, not in a tab you have to
 * remember to open. Getting it there is unfortunately three different problems
 * depending on the browser:
 *
 *   Chrome, Edge, Android. Fires `beforeinstallprompt`, which can be saved and
 *   replayed later from a real button. It only fires when a service worker with
 *   a fetch handler is controlling the page — which is why installing did not
 *   work at all until public/sw.js existed.
 *
 *   iOS Safari. Never fires it, and there is no API. The only route is Share →
 *   Add to Home Screen, so the honest thing is to say exactly that rather than
 *   show a button that cannot work.
 *
 *   Already installed. Neither of the above applies and the offer should
 *   disappear, which is what the display-mode check is for.
 *
 * The event commonly fires before React has hydrated, so an inline script in
 * the document head catches it and parks it on `window`. This module reads from
 * there rather than racing it.
 */

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallWindow {
  __mmInstallEvent?: InstallEvent | null;
  __mmInstalled?: boolean;
}

export type InstallMode = 'ready' | 'ios' | 'installed' | 'unavailable';

function win(): InstallWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as InstallWindow);
}

/** True when running from the home screen rather than in a browser tab. */
export function isInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS predates display-mode and uses its own flag.
  return Boolean((navigator as unknown as { standalone?: boolean }).standalone);
}

export function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ reports itself as a Mac, so touch points are the giveaway.
  const iPadOS = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadOS;
}

export function installMode(): InstallMode {
  if (typeof window === 'undefined') return 'unavailable';
  if (isInstalled() || win()?.__mmInstalled) return 'installed';
  if (win()?.__mmInstallEvent) return 'ready';
  if (isIos()) return 'ios';
  return 'unavailable';
}

/**
 * Show the browser's install dialogue. Resolves to whether it was accepted.
 *
 * The saved event is single-use: once prompted it cannot be replayed, so it is
 * cleared either way and the button reflects the new state.
 */
export async function promptInstall(): Promise<boolean> {
  const w = win();
  const event = w?.__mmInstallEvent;
  if (!event || !w) return false;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    w.__mmInstallEvent = null;
    if (outcome === 'accepted') w.__mmInstalled = true;
    return outcome === 'accepted';
  } catch {
    w.__mmInstallEvent = null;
    return false;
  }
}

/** Notified when the saved event arrives, or when the app gets installed. */
export function onInstallChange(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('mm:installable', fn);
  window.addEventListener('appinstalled', fn);
  return () => {
    window.removeEventListener('mm:installable', fn);
    window.removeEventListener('appinstalled', fn);
  };
}

export const IOS_STEPS = [
  'Tap the Share button at the bottom of Safari.',
  'Scroll down and tap "Add to Home Screen".',
  'Tap Add.',
];
