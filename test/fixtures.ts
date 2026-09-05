import type { DayRecord, ExternalSession, MinuteBucket, Profile } from '../lib/mm/types';

export const PROFILE: Profile = { displayName: 'Test', handle: 'test', wakeHour: 7, curfewHour: 22 };

/** Fixed "now", so partial-day behaviour is the same on every run. */
export const NOW = new Date('2026-09-05T15:00:00');

/** One minute, fully engaged unless told otherwise. */
export function minute(m: number, over: Partial<MinuteBucket> = {}): MinuteBucket {
  return { m, a: 60_000, k: 0, c: 0, s: 0, v: 0, x: 0, b: 60, ...over };
}

/** A run of consecutive fully-engaged minutes, `from` inclusive, `to` exclusive. */
export function run(from: number, to: number, over: Partial<MinuteBucket> = {}): MinuteBucket[] {
  const out: MinuteBucket[] = [];
  for (let m = from; m < to; m++) out.push(minute(m, over));
  return out;
}

export function record(
  date: string,
  buckets: MinuteBucket[],
  over: Partial<DayRecord> = {},
): DayRecord {
  const map: Record<string, MinuteBucket> = {};
  for (const b of buckets) map[String(b.m)] = b;
  return { date, buckets: map, switches: 0, externals: [], intents: {}, ...over };
}

export function logged(over: Partial<ExternalSession> = {}): ExternalSession {
  return {
    id: 'x',
    label: 'Phone',
    category: 'social',
    start: new Date('2026-09-01T20:00:00').getTime(),
    minutes: 60,
    brightness: 70,
    intensity: 'passive',
    ...over,
  };
}
