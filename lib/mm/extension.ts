'use client';

import { dayKey, ensureDay, getBucket, loadState, saveState } from './store';

/**
 * Receiving what the extension saw.
 *
 * The extension counts seconds per minute per domain across every tab. This
 * merges that into the same minute buckets the page writes, with two rules that
 * matter:
 *
 *   MEASURED TIME WINS. Where the page measured a minute itself, that stands.
 *   The extension only fills minutes the page never saw — the ones you spent in
 *   another tab. Otherwise the same minute would be counted twice.
 *
 *   INPUT IS NEVER INVENTED. The extension knows you were there; it does not
 *   know what you typed, tapped or scrolled, because it does not look. So it
 *   contributes time and nothing else. A minute filled this way has zero
 *   keystrokes because zero is what we know, not because you pressed nothing.
 *
 * Domains are kept only in a separate roll-up used for the site breakdown, and
 * never written into the behavioural record.
 */

const SOURCE = 'photon-extension';
/** What the page calls itself when it says it is ready to receive. */
const PAGE_SOURCE = 'photon-page';

interface ExtSlot {
  /** Active seconds in this minute. */
  s: number;
  /** Seconds per domain. */
  hosts: Record<string, number>;
}

interface ExtDay {
  date: string;
  minutes: Record<string, ExtSlot>;
}

export interface SiteTotal {
  host: string;
  minutes: number;
}

let installed = false;
let lastMerge = 0;
const listeners = new Set<() => void>();

export function extensionInstalled(): boolean {
  return installed;
}

export function onExtensionData(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Minutes per domain for a day, biggest first. Only the extension can know this. */
export function sitesFor(date: string): SiteTotal[] {
  try {
    const raw = localStorage.getItem('photon.sites');
    if (!raw) return [];
    const all = JSON.parse(raw) as Record<string, Record<string, number>>;
    const day = all[date];
    if (!day) return [];
    return Object.entries(day)
      .map(([host, seconds]) => ({ host, minutes: seconds / 60 }))
      .sort((a, b) => b.minutes - a.minutes);
  } catch {
    return [];
  }
}

function mergeDays(days: Record<string, ExtDay>) {
  const state = loadState();
  const sites: Record<string, Record<string, number>> = (() => {
    try {
      return JSON.parse(localStorage.getItem('photon.sites') || '{}');
    } catch {
      return {};
    }
  })();

  const today = dayKey();

  for (const [date, extDay] of Object.entries(days)) {
    // Never fabricate future days, and never touch anything the app has already
    // dropped past its retention window.
    if (date > today) continue;
    const day = ensureDay(state, date);

    for (const [minuteKey, slot] of Object.entries(extDay.minutes ?? {})) {
      const minute = Number(minuteKey);
      if (!Number.isFinite(minute) || minute < 0 || minute > 1439) continue;

      const existing = day.buckets[String(minute)];
      // The page's own measurement is the better record — it knows what you did,
      // not merely that you were there. Only fill the gaps.
      if (!existing || existing.a <= 0) {
        const bucket = getBucket(day, minute, state.brightness);
        bucket.a = Math.max(bucket.a, Math.min(60_000, slot.s * 1000));
        // Deliberately no keys, clicks or scroll: the extension does not look,
        // so it has nothing honest to contribute to those.
      }

      const bySite = (sites[date] = sites[date] || {});
      for (const [host, seconds] of Object.entries(slot.hosts ?? {})) {
        bySite[host] = Math.max(bySite[host] ?? 0, seconds);
      }
    }
  }

  saveState(state);
  try {
    localStorage.setItem('photon.sites', JSON.stringify(sites));
  } catch {
    /* the behavioural record matters more than the site roll-up */
  }
  listeners.forEach((fn) => fn());
}

/**
 * Start listening for the extension. Safe to call once on mount; if no
 * extension is installed nothing ever arrives and the app stays tab-only.
 */
export function listenForExtension(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onMessage = (e: MessageEvent) => {
    // Same-origin only, and only our own shape. A page can receive anything.
    if (e.source !== window || e.origin !== window.location.origin) return;
    const data = e.data as { source?: string; hello?: boolean; days?: Record<string, ExtDay> };
    if (data?.source !== SOURCE) return;

    installed = true;
    if (data.hello) {
      listeners.forEach((fn) => fn());
      return;
    }
    if (!data.days) return;

    /*
     * An empty payload must not start the clock.
     *
     * The extension banks on a minute boundary, so the very first answer after
     * a page load is frequently `{}` — it knows nothing yet. Throttling on that
     * used to lock out the next payload, the one that actually had the day in
     * it, for a full twenty seconds. Nothing is merged here, so nothing is
     * spent here.
     */
    const now = Date.now();
    if (Object.keys(data.days).length === 0) return;
    if (now - lastMerge < 20_000) return;
    lastMerge = now;

    try {
      mergeDays(data.days);
    } catch {
      // Malformed payload from a mismatched extension version. Better to stay
      // tab-only than to corrupt the record.
    }
  };

  window.addEventListener('message', onMessage);

  /*
   * Tell the extension we are here.
   *
   * The content script runs at document_idle, which is always before React has
   * hydrated and attached the listener above — so an extension that only
   * announced itself was talking to nobody, every single time. The page has to
   * open the conversation, because the page is the one that knows when it can
   * hear.
   *
   * Repeated a few times over the first couple of seconds for the other order:
   * a content script that has not run yet cannot answer a question asked before
   * it existed. After that, silence means no extension.
   */
  const hello = () => window.postMessage({ source: PAGE_SOURCE, type: 'ready' }, window.location.origin);
  hello();
  const retries = [250, 1000, 2500].map((ms) => window.setTimeout(hello, ms));

  return () => {
    window.removeEventListener('message', onMessage);
    retries.forEach(window.clearTimeout);
  };
}
