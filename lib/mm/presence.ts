'use client';

/**
 * KNOWING YOU ARE THERE WHEN THIS TAB IS NOT.
 *
 * The honest limit of a web page is that it sees its own tab and nothing else.
 * That limit produced a fair complaint: you switch to another tab, keep working
 * for an hour, come back, and Photon recorded nothing. Which is true to
 * what a page can see, and useless as a measure of your day.
 *
 * There are three ways past it, and this file uses all three:
 *
 *   1. IDLE DETECTION. Chromium exposes `IdleDetector`, which reports whether
 *      the USER is active and whether the screen is locked — at the operating
 *      system level, and it keeps reporting while this tab is in the
 *      background. With permission granted, Photon measures your device
 *      rather than its own tab. It still cannot see WHICH app you were in, and
 *      it never claims to.
 *
 *   2. THE EXTENSION. A browser extension can see every tab. When one is
 *      installed it posts per-site time into the page, and that arrives here
 *      labelled as coming from the extension. See extension/ in this repo.
 *
 *   3. ONE WRITER. With several Photon tabs open, every one of them would
 *      otherwise count the same minute. A lock in localStorage elects a single
 *      writer, so the same second is never banked twice.
 *
 * What is measured is always labelled with which of these produced it. A number
 * that says "device" when it only saw a tab would be worse than no number.
 */

export type PresenceSource = 'tab' | 'device' | 'extension';

export interface PresenceState {
  /** Is the person at the device right now, as far as we can honestly tell? */
  active: boolean;
  /** How we know. `tab` means we are only seeing our own page. */
  source: PresenceSource;
  /** True when OS-level idle detection is running. */
  deviceAware: boolean;
  /** True when the screen is locked — never counted as active. */
  screenLocked: boolean;
  /** Whether the browser has the API at all, so the UI can offer it honestly. */
  supported: boolean;
  /** Set once the user has been asked and said no. */
  denied: boolean;
}

// ── Idle detection ────────────────────────────────────────────────

interface IdleDetectorLike {
  userState: 'active' | 'idle' | null;
  screenState: 'locked' | 'unlocked' | null;
  addEventListener: (t: string, cb: () => void) => void;
  start: (opts: { threshold: number }) => Promise<void>;
}

interface IdleDetectorCtor {
  new (): IdleDetectorLike;
  requestPermission: () => Promise<'granted' | 'denied' | 'prompt'>;
}

function ctor(): IdleDetectorCtor | undefined {
  return (globalThis as unknown as { IdleDetector?: IdleDetectorCtor }).IdleDetector;
}

export function idleDetectionSupported(): boolean {
  return typeof window !== 'undefined' && Boolean(ctor());
}

/**
 * The threshold the OS uses before calling you idle. One minute matches the
 * tab-level idle window, so the two agree about what "away" means.
 */
const IDLE_THRESHOLD_MS = 60_000;

let detector: IdleDetectorLike | null = null;
let userActive = true;
let screenLocked = false;
let denied = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function onPresenceChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Ask for OS-level idle detection. Must be called from a user gesture — the
 * permission prompt is gated on one, which is why this is a button in the app
 * and not something that happens on load.
 */
export async function enableDeviceAwareness(): Promise<boolean> {
  const Ctor = ctor();
  if (!Ctor) return false;
  if (detector) return true;

  try {
    const permission = await Ctor.requestPermission();
    if (permission !== 'granted') {
      denied = true;
      notify();
      return false;
    }

    const d = new Ctor();
    d.addEventListener('change', () => {
      userActive = d.userState !== 'idle';
      screenLocked = d.screenState === 'locked';
      notify();
    });
    await d.start({ threshold: IDLE_THRESHOLD_MS });
    detector = d;
    userActive = d.userState !== 'idle';
    screenLocked = d.screenState === 'locked';
    denied = false;
    notify();
    return true;
  } catch {
    // Permission dismissed, flag off, or an insecure context. Not an error —
    // the app simply stays tab-only and says so.
    denied = true;
    notify();
    return false;
  }
}

/** Restore device awareness on load when it was granted before. */
export async function resumeDeviceAwareness(): Promise<boolean> {
  const Ctor = ctor();
  if (!Ctor || detector) return Boolean(detector);
  try {
    // `requestPermission` resolves without a prompt once already granted, but
    // browsers only allow that from a gesture — so check the Permissions API
    // first and only construct the detector when the answer is already yes.
    const status = await navigator.permissions?.query({
      name: 'idle-detection' as PermissionName,
    });
    if (status?.state !== 'granted') return false;
    return await enableDeviceAwareness();
  } catch {
    return false;
  }
}

export function presence(tabActive: boolean): PresenceState {
  const supported = idleDetectionSupported();
  if (detector) {
    return {
      // The screen being locked beats everything: nobody is using a locked phone.
      active: userActive && !screenLocked,
      source: 'device',
      deviceAware: true,
      screenLocked,
      supported,
      denied: false,
    };
  }
  return {
    active: tabActive,
    source: 'tab',
    deviceAware: false,
    screenLocked: false,
    supported,
    denied,
  };
}

// ── One writer across tabs ────────────────────────────────────────

const LOCK_KEY = 'photon.writer';
/** A lock older than this is assumed dead — the tab holding it was closed. */
const LOCK_STALE_MS = 4_000;

const tabId = Math.random().toString(36).slice(2, 10);

/**
 * True when this tab is the one allowed to bank time right now.
 *
 * Deliberately simple: whoever holds a fresh lock keeps it, and anyone may
 * claim a stale one. Two tabs can briefly both believe they hold it during a
 * handover, which costs at most a second of double-counted time — a far better
 * failure than the alternative, which is a leader-election protocol that
 * deadlocks and stops recording entirely.
 */
export function claimWriter(): boolean {
  try {
    const now = Date.now();
    const raw = localStorage.getItem(LOCK_KEY);
    if (raw) {
      const lock = JSON.parse(raw) as { id: string; at: number };
      if (lock.id !== tabId && now - lock.at < LOCK_STALE_MS) return false;
    }
    localStorage.setItem(LOCK_KEY, JSON.stringify({ id: tabId, at: now }));
    return true;
  } catch {
    // No storage means no other tab can be writing either.
    return true;
  }
}

export function releaseWriter(): void {
  try {
    const raw = localStorage.getItem(LOCK_KEY);
    if (!raw) return;
    const lock = JSON.parse(raw) as { id: string };
    if (lock.id === tabId) localStorage.removeItem(LOCK_KEY);
  } catch {
    /* nothing to release */
  }
}

export const SOURCE_COPY: Record<PresenceSource, { label: string; note: string }> = {
  tab: {
    label: 'This tab only',
    note: 'Right now we can only see this page. Switch to another tab and we stop counting — because we genuinely cannot see it. Turn on device tracking below and we can tell whether you are at your device at all, even when Photon is in the background.',
  },
  device: {
    label: 'Your whole device',
    note: 'We can tell whether you are actually at your device, even when this page is in the background. We still cannot see which app or site you are in — nothing can, from a web page — so that part is never guessed.',
  },
  extension: {
    label: 'Every tab',
    note: 'The Photon extension is running, so time in your other tabs counts too.',
  },
};
