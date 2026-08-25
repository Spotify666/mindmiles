/**
 * MIND MILES — the part that can see your other tabs.
 *
 * A web page cannot look outside itself. An extension can, so this does the one
 * job the page genuinely cannot: notice which tab is in front, and for how long.
 *
 * What it records, per minute:
 *   how many seconds you were active, and on which site (the domain only).
 *
 * What it never records:
 *   the page title, the path, the query string, anything you typed, anything on
 *   the page. The full URL is reduced to a hostname the moment it is seen and
 *   the rest is dropped before anything is written down.
 *
 * Where it goes: chrome.storage.local, on this machine. There is no network
 * call anywhere in this file, and no server for one to reach. When you open
 * Mind Miles, bridge.js hands the totals to the page and the page merges them
 * in, clearly labelled as having come from here.
 */

const TICK_ALARM = 'mm-tick';
/** No input for this long and you are not using the computer. */
const IDLE_SECONDS = 60;
/** Older than this and it is beyond what the app keeps anyway. */
const RETAIN_DAYS = 90;

let lastSeenAt = Date.now();
let lastHost = null;
let idle = false;

function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Hostname only. The path and query are dropped here and never stored. */
function hostOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function activeHost() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !tab.url) return null;
    return hostOf(tab.url);
  } catch {
    return null;
  }
}

/**
 * Bank the seconds since the last check against the host that was in front.
 * Called on a one-minute alarm and on every focus change, so a quick visit to
 * another tab is still attributed correctly.
 */
async function bank() {
  const now = Date.now();
  const elapsedSec = Math.min(Math.round((now - lastSeenAt) / 1000), 120);
  lastSeenAt = now;

  const host = lastHost;
  lastHost = await activeHost();

  if (idle || !host || elapsedSec <= 0) return;

  const date = dayKey();
  const minute = new Date().getHours() * 60 + new Date().getMinutes();
  const store = await chrome.storage.local.get('days');
  const days = store.days || {};
  const day = (days[date] = days[date] || { date, minutes: {} });

  const slot = (day.minutes[minute] = day.minutes[minute] || { s: 0, hosts: {} });
  slot.s = Math.min(60, slot.s + elapsedSec);
  slot.hosts[host] = (slot.hosts[host] || 0) + elapsedSec;

  // Drop anything past the retention window so this cannot grow forever.
  const cutoff = dayKey(new Date(Date.now() - RETAIN_DAYS * 86400000));
  for (const k of Object.keys(days)) if (k < cutoff) delete days[k];

  await chrome.storage.local.set({ days });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
  chrome.idle.setDetectionInterval(IDLE_SECONDS);
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 1 });
  chrome.idle.setDetectionInterval(IDLE_SECONDS);
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === TICK_ALARM) bank();
});

// A tab change ends the previous host's stretch immediately rather than at the
// next alarm, so switching every twenty seconds is still counted correctly.
chrome.tabs.onActivated.addListener(() => bank());
chrome.tabs.onUpdated.addListener((_id, info) => {
  if (info.url) bank();
});
chrome.windows.onFocusChanged.addListener(() => bank());

chrome.idle.onStateChanged.addListener((state) => {
  // Bank what came before the state change, then flip.
  bank().then(() => {
    idle = state !== 'active';
    lastSeenAt = Date.now();
  });
});

// The page asks for the totals when it opens; this is the only way data leaves
// the extension, and it only ever goes to the Mind Miles page on this machine.
chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type !== 'mind-miles:pull') return false;
  bank().then(async () => {
    const store = await chrome.storage.local.get('days');
    respond({ type: 'mind-miles:data', days: store.days || {} });
  });
  return true;
});
