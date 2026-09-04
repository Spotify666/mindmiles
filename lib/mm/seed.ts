'use client';

import { makeRng, type Rng } from './rng';
import { dayKeyOffset, loadState, saveState } from './store';
import type { Category, DayRecord, MinuteBucket } from './types';

/**
 * Sample history.
 *
 * A measurement product is unreadable on day one: every chart is empty, every
 * baseline says "building", and the user has no way to tell whether the thing
 * works. So a first run seeds 30 days of plausible history, labelled as sample
 * data everywhere it surfaces, wipeable in one tap, and never mixed silently
 * with real measurement — the moment tracking is on, real minutes accumulate
 * alongside it and the Method page says which is which.
 *
 * The generated person is deliberately not an ideal one. They have a decent
 * working rhythm, a scrolling habit that worsens on weekday evenings, a
 * late-night drift across the most recent week, and two genuinely good days.
 * A demo where everything is fine demonstrates nothing.
 */

interface Block {
  /** Minute of day. */
  start: number;
  len: number;
  /** 0–1, drives keystroke and click volume. */
  intensity: number;
  brightness: number;
  /** How the block behaves: work produces, feed scrolls, mixed does both. */
  mode: 'work' | 'feed' | 'mixed';
  /** Switches generated across the block. */
  churn: number;
}

/** Trend factor: the recent past drifts slightly worse, so improvement is visible. */
function drift(offset: number): number {
  // offset is negative days back. −29 → 0, 0 → 1.
  return 1 + (Math.max(-29, offset) + 29) / 29 * 0.22;
}

function weekdayBlocks(rng: Rng, offset: number): Block[] {
  const j = (n: number) => Math.round(n + (rng() - 0.5) * n * 0.3);
  const d = drift(offset);
  const blocks: Block[] = [
    { start: j(8 * 60 + 40), len: j(22), intensity: 0.3, brightness: 72, mode: 'feed', churn: 6 },
    { start: j(9 * 60 + 20), len: j(96), intensity: 0.85, brightness: 74, mode: 'work', churn: 3 },
    { start: j(11 * 60 + 25), len: j(68), intensity: 0.72, brightness: 74, mode: 'mixed', churn: 7 },
    { start: j(13 * 60 + 50), len: j(112), intensity: 0.88, brightness: 72, mode: 'work', churn: 4 },
    { start: j(16 * 60 + 15), len: j(74), intensity: 0.55, brightness: 70, mode: 'mixed', churn: 11 },
    { start: j(20 * 60 + 40), len: Math.round(j(62) * d), intensity: 0.22, brightness: 84, mode: 'feed', churn: 14 },
  ];
  // Late-night drift, more likely in the most recent fortnight.
  if (rng() > 0.62 - (offset > -14 ? 0.18 : 0)) {
    blocks.push({
      start: j(23 * 60 + 5),
      len: Math.round(j(42) * d),
      intensity: 0.18,
      brightness: 88,
      mode: 'feed',
      churn: 9,
    });
  }
  return blocks;
}

function weekendBlocks(rng: Rng, offset: number): Block[] {
  const j = (n: number) => Math.round(n + (rng() - 0.5) * n * 0.32);
  const d = drift(offset);
  const blocks: Block[] = [
    { start: j(10 * 60 + 40), len: j(52), intensity: 0.3, brightness: 68, mode: 'feed', churn: 9 },
    { start: j(15 * 60 + 20), len: j(78), intensity: 0.45, brightness: 68, mode: 'mixed', churn: 8 },
    { start: j(21 * 60), len: Math.round(j(92) * d), intensity: 0.22, brightness: 85, mode: 'feed', churn: 12 },
  ];
  if (rng() > 0.34) {
    blocks.push({
      start: j(23 * 60 + 35),
      len: Math.round(j(56) * d),
      intensity: 0.16,
      brightness: 90,
      mode: 'feed',
      churn: 7,
    });
  }
  return blocks;
}

/** Two standout days in the last fortnight, so records and wins have something to sit on. */
function isGoodDay(offset: number): boolean {
  return offset === -3 || offset === -11;
}

function goodDayBlocks(rng: Rng): Block[] {
  const j = (n: number) => Math.round(n + (rng() - 0.5) * n * 0.18);
  return [
    { start: j(9 * 60 + 5), len: j(134), intensity: 0.9, brightness: 68, mode: 'work', churn: 1 },
    { start: j(13 * 60 + 30), len: j(96), intensity: 0.86, brightness: 68, mode: 'work', churn: 2 },
    { start: j(16 * 60 + 20), len: j(52), intensity: 0.6, brightness: 66, mode: 'mixed', churn: 4 },
    { start: j(19 * 60 + 40), len: j(26), intensity: 0.3, brightness: 62, mode: 'feed', churn: 3 },
  ];
}

function buildDay(date: string, offset: number): DayRecord {
  const rng = makeRng(`photon-seed:${date}`);
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const weekend = weekday === 0 || weekday === 6;

  const blocks = isGoodDay(offset)
    ? goodDayBlocks(rng)
    : weekend
      ? weekendBlocks(rng, offset)
      : weekdayBlocks(rng, offset);

  const buckets: Record<string, MinuteBucket> = {};
  let switches = 0;

  for (const b of blocks) {
    const churnMinutes = new Set<number>();
    for (let i = 0; i < b.churn; i++) churnMinutes.add(Math.floor(rng() * Math.max(b.len, 1)));

    for (let i = 0; i < b.len; i++) {
      const m = (b.start + i) % 1440;
      // Occasional micro-gaps so bouts break the way real ones do.
      if (rng() < 0.04) continue;

      const feed = b.mode === 'feed' || (b.mode === 'mixed' && rng() < 0.4);
      const active = 40_000 + rng() * 20_000;

      buckets[String(m)] = {
        m,
        a: Math.min(60_000, Math.round(active)),
        k: feed ? Math.round(rng() * 6) : Math.round(20 + rng() * 150 * b.intensity),
        c: feed ? Math.round(rng() * 4) : Math.round(rng() * 7 * b.intensity),
        s: feed ? Math.round(600 + rng() * 2600) : Math.round(rng() * 700),
        // Rapid scrolling is a property of feed minutes, which is what makes
        // the burst threshold meaningful rather than decorative.
        v: feed ? Math.round(900 + rng() * 2200) : Math.round(rng() * 700),
        x: churnMinutes.has(i) ? 1 + Math.round(rng() * 2) : 0,
        b: Math.round(b.brightness + (rng() - 0.5) * 8),
      };
      switches += buckets[String(m)].x;
    }
  }

  // Today is still running: nothing in the future may appear.
  if (offset === 0) {
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (const key of Object.keys(buckets)) {
      if (Number(key) > nowMin) delete buckets[key];
    }
  }

  const intents: Partial<Record<Category, number>> = weekend
    ? {}
    : { work: 240, reading: 30, recovery: 60 };

  return { date, buckets, switches, externals: [], intents };
}

/** How much history is generated on first run. Enough for a 28-day baseline plus margin. */
export const SEED_DAYS = 30;

/** Populate sample history. No-op once real or sample data exists, unless forced. */
export function seedSampleHistory(force = false): void {
  const state = loadState();
  if (state.seeded && !force) return;

  for (let i = SEED_DAYS - 1; i >= 0; i--) {
    const date = dayKeyOffset(-i);
    if (!force && state.days[date]) continue;
    state.days[date] = buildDay(date, -i);
  }

  // One hand-logged session, to demonstrate that the feature exists and that
  // logged time is kept visibly separate from measured time.
  const today = dayKeyOffset(0);
  const day = state.days[today];
  if (day && day.externals.length === 0) {
    const start = new Date();
    start.setHours(19, 15, 0, 0);
    day.externals.push({
      id: 'sample01',
      label: 'Phone — video',
      category: 'entertainment',
      start: start.getTime(),
      minutes: 34,
      brightness: 85,
      intensity: 'passive',
    });
  }

  state.seeded = true;
  saveState(state);
}
