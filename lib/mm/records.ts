import { fmtMiles, fmtMin } from './format';
import type { DayReport, PersonalRecord } from './types';

/**
 * PERSONAL RECORDS.
 *
 * The single most important design decision in this file is the qualifying
 * floor on every record.
 *
 * A record for "lowest fragmentation" with no floor is won by leaving your
 * laptop shut. A record for "longest screen-free window" with no floor is won
 * by going on holiday. Records like that would quietly turn the product into
 * the leaderboard of who uses their phone least — which is the exact thing this
 * product refuses to be, because it says nothing about whether anyone is using
 * technology well.
 *
 * So every record that could be won by absence carries a minimum engaged time.
 * You have to show up to set one. A record is proof you had a demanding day and
 * handled it, not proof you avoided having one.
 */

interface RecordDef {
  key: string;
  label: string;
  blurb: string;
  /** Which way is a record. */
  direction: 'max' | 'min';
  /** Minimum engaged minutes for a day to be eligible at all. */
  floor: number;
  value: (r: DayReport) => number | null;
  display: (v: number) => string;
}

const DEFS: RecordDef[] = [
  {
    key: 'longest-focus',
    label: 'Longest focus session',
    blurb: 'The longest you have ever stayed with one thing without stopping.',
    direction: 'max',
    floor: 0,
    value: (r) => (r.summary.longestBoutMin >= 25 ? r.summary.longestBoutMin : null),
    display: (v) => fmtMin(v),
  },
  {
    key: 'most-focus-miles',
    label: 'Most focus miles',
    blurb: 'The most focused time you have ever managed in one day.',
    direction: 'max',
    floor: 0,
    value: (r) => r.summary.miles.focus,
    display: (v) => `${fmtMiles(v)} mi`,
  },
  {
    key: 'lowest-fragmentation',
    label: 'Calmest day',
    blurb: 'Your least jumpy day. Only counts on a proper working day.',
    direction: 'min',
    // Two hours engaged, or this is won by a day off rather than a day handled.
    floor: 120,
    value: (r) => r.fragmentation.value,
    display: (v) => `${Math.round(v)} / 100`,
  },
  {
    key: 'best-recovery',
    label: 'Best rest',
    blurb: 'Breaks taken, evening left alone, and you let up during the day.',
    direction: 'max',
    floor: 60,
    value: (r) => r.recovery.value,
    display: (v) => `${Math.round(v)} / 100`,
  },
  {
    key: 'longest-break',
    label: 'Longest time away',
    blurb: 'Your biggest break in the middle of a busy day — not a day you were simply out.',
    direction: 'max',
    floor: 120,
    value: (r) => (r.summary.longestBreakMin > 0 ? r.summary.longestBreakMin : null),
    display: (v) => fmtMin(v),
  },
  {
    key: 'best-fitness',
    label: 'Best day overall',
    blurb: 'Your highest score for a single day.',
    direction: 'max',
    floor: 60,
    value: (r) => r.fitness.value,
    display: (v) => `${Math.round(v)}`,
  },
  {
    key: 'lowest-scroll',
    label: 'Least scrolling',
    blurb: 'The least fast scrolling you have done on a full day of screen time.',
    direction: 'min',
    floor: 120,
    value: (r) => r.summary.miles.scroll,
    display: (v) => `${fmtMiles(v)} mi`,
  },
  {
    key: 'best-evening',
    label: 'Best evening',
    blurb: 'The least time after 11pm on a day you were really using screens.',
    direction: 'min',
    floor: 180,
    value: (r) => r.summary.lateNightMin,
    display: (v) => (v === 0 ? 'Nothing after 23:00' : fmtMin(v)),
  },
  {
    key: 'most-intentional',
    label: 'Most on-plan day',
    blurb: 'The closest a day has come to what you wanted from it.',
    direction: 'max',
    floor: 60,
    value: (r) => (r.intentionality.provenance === 'unavailable' ? null : r.intentionality.value),
    display: (v) => `${Math.round(v)}%`,
  },
];

/**
 * Compute every record across the available history.
 *
 * Partial days are excluded: today is still running, and a day cannot hold a
 * record for "lowest late-night use" at two in the afternoon.
 */
export function personalRecords(
  reports: DayReport[],
  seen: Record<string, number> = {},
): PersonalRecord[] {
  const eligible = reports.filter((r) => !r.summary.partial);
  const out: PersonalRecord[] = [];

  for (const def of DEFS) {
    const candidates = eligible
      .filter((r) => r.summary.activeMin >= def.floor)
      .map((r) => ({ date: r.date, value: def.value(r) }))
      .filter((c): c is { date: string; value: number } => c.value !== null);

    if (candidates.length === 0) continue;

    const sorted = [...candidates].sort((a, b) =>
      def.direction === 'max' ? b.value - a.value : a.value - b.value,
    );
    const best = sorted[0];
    // The previous best must be a genuinely different value, or every record
    // would report itself as having just beaten a tie.
    const previous = sorted.find((c) => c.value !== best.value);

    const acknowledged = seen[def.key];
    const isNew =
      acknowledged === undefined
        ? candidates.length > 1
        : def.direction === 'max'
          ? best.value > acknowledged
          : best.value < acknowledged;

    out.push({
      key: def.key,
      label: def.label,
      display: def.display(best.value),
      value: best.value,
      date: best.date,
      previous: previous?.value,
      previousDisplay: previous ? def.display(previous.value) : undefined,
      previousDate: previous?.date,
      isNew,
      blurb: def.blurb,
    });
  }

  return out;
}

/** Records set on a specific date — what the Today screen celebrates. */
export function recordsSetOn(records: PersonalRecord[], date: string): PersonalRecord[] {
  return records.filter((r) => r.date === date);
}

/** The map to persist once a record has been shown, so it stops reading as new. */
export function acknowledgementMap(records: PersonalRecord[]): Record<string, number> {
  return Object.fromEntries(records.map((r) => [r.key, r.value]));
}
