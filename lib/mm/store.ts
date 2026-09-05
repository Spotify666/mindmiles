'use client';

import {
  type Category,
  type ChallengeEnrollment,
  type DayRecord,
  type ExternalSession,
  type PhotonState,
  type MinuteBucket,
  type Profile,
  type SharingPrefs,
} from './types';

/**
 * Local-first persistence.
 *
 * localStorage only. No network call is made from anywhere in this file, and
 * there is no code path in the app that ships a DayRecord off the device.
 *
 * Every read and write is wrapped: storage throws in private windows and when
 * site data is blocked, and the correct behaviour there is to keep measuring
 * in memory for the session rather than to break the page. The user is told
 * when that happens rather than being quietly given a broken product.
 */

const KEY = 'photon.v1';
/** What the store was called before the app was renamed. Read once, then retired. */
const LEGACY_KEY = 'mindmiles.v1';
const VERSION = 1;

/**
 * History is kept for 90 days: long enough for a monthly baseline and a
 * meaningful 30-day trend, short enough that the store cannot grow without
 * bound on a device the user never clears.
 */
export const RETAIN_DAYS = 90;

export const DEFAULT_PROFILE: Profile = {
  displayName: 'You',
  handle: 'you',
  wakeHour: 7,
  curfewHour: 22,
};

/** Nothing is shared until the user turns it on, one field at a time. */
export const DEFAULT_SHARING: SharingPrefs = {
  fitness: true,
  miles: true,
  records: true,
  challenges: true,
  reclaimed: true,
  streak: true,
};

function emptyState(): PhotonState {
  return {
    version: VERSION,
    brightness: 70,
    brightnessSet: false,
    enabled: false,
    seeded: false,
    onboarded: false,
    profile: { ...DEFAULT_PROFILE },
    days: {},
    challenges: {},
    seenRecords: {},
    sharing: { ...DEFAULT_SHARING },
  };
}

let memo: PhotonState | null = null;
let storageBlocked = false;

/** True when localStorage refused a write — the UI surfaces this honestly. */
export function isStorageBlocked(): boolean {
  return storageBlocked;
}

// ─────────────────────────── date keys ───────────────────────────

export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return dayKey();
}

export function dayKeyOffset(offset: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + offset);
  return dayKey(d);
}

/** The last `n` day keys, oldest first, ending today. */
export function recentKeys(n: number): string[] {
  return Array.from({ length: n }, (_, i) => dayKeyOffset(-(n - 1 - i)));
}

// ─────────────────────────── load / save ───────────────────────────

export function loadState(): PhotonState {
  if (memo) return memo;
  try {
    // A rename should not cost anyone their history. If the old key is still
    // there and the new one is not, adopt it and move on.
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        localStorage.setItem(KEY, legacy);
        localStorage.removeItem(LEGACY_KEY);
        raw = legacy;
      }
    }
    if (!raw) {
      memo = emptyState();
      return memo;
    }
    const parsed = JSON.parse(raw) as Partial<PhotonState>;
    if (parsed.version !== VERSION || typeof parsed.days !== 'object') {
      memo = emptyState();
      return memo;
    }
    // Merge over the empty shape so a store written by an older build that
    // lacked a field still loads instead of throwing on first access.
    memo = {
      ...emptyState(),
      ...parsed,
      profile: { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) },
      sharing: { ...DEFAULT_SHARING, ...(parsed.sharing ?? {}) },
      days: parsed.days ?? {},
      challenges: parsed.challenges ?? {},
      seenRecords: parsed.seenRecords ?? {},
    };
    return memo;
  } catch {
    memo = emptyState();
    return memo;
  }
}

export function saveState(state: PhotonState): PhotonState {
  memo = state;
  try {
    const cutoff = dayKeyOffset(-RETAIN_DAYS);
    for (const k of Object.keys(state.days)) {
      // Keys are ISO dates, so lexical comparison is chronological.
      if (k < cutoff) delete state.days[k];
    }
    localStorage.setItem(KEY, JSON.stringify(state));
    storageBlocked = false;
  } catch {
    // Quota exceeded or storage blocked. Keep running from memory so the
    // session still measures; the banner tells the user it will not persist.
    storageBlocked = true;
  }
  return state;
}

// ─────────────────────────── record access ───────────────────────────

export function ensureDay(state: PhotonState, date = todayKey()): DayRecord {
  let day = state.days[date];
  if (!day) {
    day = { date, buckets: {}, switches: 0, externals: [], intents: {} };
    state.days[date] = day;
  }
  // Defensive: a record written before `intents` existed would be missing it.
  if (!day.intents) day.intents = {};
  if (!day.externals) day.externals = [];
  return day;
}

export function getBucket(day: DayRecord, minuteOfDay: number, brightness: number): MinuteBucket {
  const key = String(minuteOfDay);
  let b = day.buckets[key];
  if (!b) {
    b = { m: minuteOfDay, a: 0, k: 0, c: 0, s: 0, v: 0, x: 0, b: brightness };
    day.buckets[key] = b;
  }
  return b;
}

// ─────────────────────────── mutations ───────────────────────────

export function addExternal(session: Omit<ExternalSession, 'id'>): PhotonState {
  const state = loadState();
  const day = ensureDay(state, dayKey(new Date(session.start)));
  day.externals.push({
    ...session,
    id: Math.random().toString(36).slice(2, 10),
  });
  return saveState(state);
}

export function removeExternal(date: string, id: string): PhotonState {
  const state = loadState();
  const day = state.days[date];
  if (day) day.externals = day.externals.filter((e) => e.id !== id);
  return saveState(state);
}

export function setIntent(date: string, category: Category, minutes: number): PhotonState {
  const state = loadState();
  const day = ensureDay(state, date);
  if (minutes <= 0) delete day.intents[category];
  else day.intents[category] = Math.round(minutes);
  return saveState(state);
}

export function setBrightness(value: number): PhotonState {
  const state = loadState();
  state.brightness = Math.max(0, Math.min(100, Math.round(value)));
  state.brightnessSet = true;
  return saveState(state);
}

export function setRoomLight(value: number, at: number): PhotonState {
  const state = loadState();
  state.roomLight = { value, at };
  return saveState(state);
}

export function clearRoomLight(): PhotonState {
  const state = loadState();
  delete state.roomLight;
  return saveState(state);
}

/** Hand brightness back to automatic detection, or to nothing at all. */
export function clearBrightness(): PhotonState {
  const state = loadState();
  state.brightnessSet = false;
  return saveState(state);
}

export function setEnabled(enabled: boolean): PhotonState {
  const state = loadState();
  state.enabled = enabled;
  return saveState(state);
}

export function setOnboarded(v: boolean): PhotonState {
  const state = loadState();
  state.onboarded = v;
  return saveState(state);
}

export function updateProfile(patch: Partial<Profile>): PhotonState {
  const state = loadState();
  state.profile = { ...state.profile, ...patch };
  return saveState(state);
}

export function updateSharing(patch: Partial<SharingPrefs>): PhotonState {
  const state = loadState();
  state.sharing = { ...state.sharing, ...patch };
  return saveState(state);
}

export function joinChallenge(id: string): PhotonState {
  const state = loadState();
  state.challenges[id] = { id, startedOn: todayKey() };
  return saveState(state);
}

export function leaveChallenge(id: string): PhotonState {
  const state = loadState();
  delete state.challenges[id];
  return saveState(state);
}

export function completeChallenge(id: string, on: string): PhotonState {
  const state = loadState();
  const e: ChallengeEnrollment | undefined = state.challenges[id];
  if (e && !e.completedOn) {
    e.completedOn = on;
    return saveState(state);
  }
  return state;
}

/** Mark a personal record as seen so it stops being flagged as new. */
export function acknowledgeRecords(entries: Record<string, number>): PhotonState {
  const state = loadState();
  state.seenRecords = { ...state.seenRecords, ...entries };
  return saveState(state);
}

// ─────────────────────────── data rights ───────────────────────────

export function exportJson(): string {
  return JSON.stringify(loadState(), null, 2);
}

/**
 * Wipe everything. Deliberately total and deliberately one call — a delete
 * that leaves residue behind is not a delete.
 */
export function clearAll(): PhotonState {
  memo = emptyState();
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to remove */
  }
  return memo;
}

/** Drop measured history but keep profile, intentions and sharing settings. */
export function clearHistory(): PhotonState {
  const state = loadState();
  state.days = {};
  state.seeded = false;
  state.seenRecords = {};
  return saveState(state);
}
