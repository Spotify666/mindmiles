import type { Baseline } from './baseline';
import { fmtMin, fmtMiles, isWeekend, plural } from './format';
import { totalMileage } from './metrics';
import { reclaimedTime } from './reclaimed';
import type { DayReport, DaySummary, PersonalRecord, Reclaimed } from './types';

/**
 * THE WEEK.
 *
 * Every product this one is measured against has a weekly moment: RescueTime
 * mails a summary, Rize reports on the week, Screen Time pushes one every
 * Sunday. Photon had trends — a chart you have to go and read — and nothing
 * that ever arrives.
 *
 * The distinction matters more here than it does for them. The stated aim is an
 * engagement loop that does not reward opening the app, which rules out the
 * daily streak and the notification badge, and leaves exactly one honest shape:
 * a review that is worth reading once a week and says nothing on the other six
 * days. It is the review, not the dashboard, that this product is for.
 *
 * What it will not do is grade the week. There is no weekly score, because a
 * week is a unit of a person's life and not a test, and because the number
 * would immediately become the thing people optimised — which is how a tool for
 * noticing turns into one more thing to be good at.
 */

export interface WeekReview {
  from: string;
  to: string;
  /** Days in the window with enough measurement to say anything about. */
  days: number;
  miles: ReturnType<typeof totalMileage>;
  /** The same window, seven days earlier, when there is one. */
  previous: ReturnType<typeof totalMileage> | null;
  focusChange: number | null;
  scrollChange: number | null;
  reclaimed: Reclaimed;
  bestDay: { date: string; report: DayReport } | null;
  hardestDay: { date: string; report: DayReport } | null;
  records: PersonalRecord[];
  blocksKept: number;
  /** The week in a sentence, and one thing worth trying next week. */
  headline: string;
  oneThing: string | null;
  /** True once the week holds enough to be worth reading. */
  ready: boolean;
}

const MIN_DAYS = 3;

function change(now: number, before: number): number | null {
  // A percentage against almost nothing is noise wearing a number's clothes.
  return before > 0.5 ? ((now - before) / before) * 100 : null;
}

export function weekReview(
  reports: DayReport[],
  baseline: Baseline,
  blocksKept = 0,
  records: PersonalRecord[] = [],
): WeekReview {
  const window = reports.slice(-7);
  const before = reports.slice(-14, -7);
  const summaries = window.map((r) => r.summary);
  const counted = summaries.filter((s) => s.activeMin >= 15);

  const miles = totalMileage(summaries);
  const previous = before.length > 0 ? totalMileage(before.map((r) => r.summary)) : null;
  const reclaimed = reclaimedTime(summaries, baseline);

  const scored = window.filter((r) => r.summary.activeMin >= 15);
  const bestDay = pick(scored, (r) => r.fitness.value, 'max');
  const hardestDay = pick(scored, (r) => r.strain.value, 'max');

  const from = window[0]?.date ?? '';
  const to = window[window.length - 1]?.date ?? '';
  const ready = counted.length >= MIN_DAYS;

  const focusChange = previous ? change(miles.focus, previous.focus) : null;
  const scrollChange = previous ? change(miles.scroll, previous.scroll) : null;

  return {
    from,
    to,
    days: counted.length,
    miles,
    previous,
    focusChange,
    scrollChange,
    reclaimed,
    bestDay: bestDay && { date: bestDay.date, report: bestDay },
    hardestDay: hardestDay && { date: hardestDay.date, report: hardestDay },
    records: records.filter((r) => r.date >= from && r.date <= to),
    blocksKept,
    headline: headlineFor({ ready, counted, miles, reclaimed, focusChange }),
    oneThing: oneThingFor(counted),
    ready,
  };
}

function pick(reports: DayReport[], of: (r: DayReport) => number, dir: 'max' | 'min'): DayReport | null {
  if (reports.length === 0) return null;
  return reports.reduce((best, r) =>
    dir === 'max' ? (of(r) > of(best) ? r : best) : of(r) < of(best) ? r : best,
  );
}

function headlineFor(w: {
  ready: boolean;
  counted: DaySummary[];
  miles: ReturnType<typeof totalMileage>;
  reclaimed: Reclaimed;
  focusChange: number | null;
}): string {
  if (!w.ready) {
    return `Only ${plural(w.counted.length, 'day')} counted so far this week. Come back when there is a bit more to look at.`;
  }
  const hours = fmtMin(w.counted.reduce((s, d) => s + d.activeMin, 0));
  const focus = fmtMiles(w.miles.focus);
  if (w.reclaimed.available && w.reclaimed.minutes >= 30) {
    return `${hours} on screen this week, ${focus} miles of it properly stuck into something — and ${fmtMin(w.reclaimed.minutes)} you would usually have spent, that you did not.`;
  }
  if (w.focusChange !== null && w.focusChange >= 15) {
    return `${hours} on screen this week, and more of it in long blocks than last week. That is the part that sticks.`;
  }
  return `${hours} on screen this week, ${focus} miles of it properly stuck into something.`;
}

/**
 * One thing to try. Chosen from the week's own shape rather than a rota, and
 * always something to DO on a day, never "use your phone less".
 */
function oneThingFor(days: DaySummary[]): string | null {
  if (days.length < MIN_DAYS) return null;

  const avg = (of: (d: DaySummary) => number) => days.reduce((s, d) => s + of(d), 0) / days.length;
  const weekdays = days.filter((d) => !isWeekend(d.date));

  if (avg((d) => d.deepBouts) < 1) {
    return 'Pick one day next week and protect a single 45-minute block on it. One is enough to feel the difference; a whole reformed week is not.';
  }
  if (avg((d) => d.lateNightMin) > 30) {
    return 'Most evenings this week ran past eleven. Try putting the charger in another room on two of them — the two, not all seven.';
  }
  if (avg((d) => d.breakCount) < 1.5) {
    return 'You barely stopped. Next week, stand up once mid-morning and once mid-afternoon — ten minutes each is the whole ask.';
  }
  if (avg((d) => d.miles.scroll) > avg((d) => d.miles.focus)) {
    return 'More of the week went past fast than went in deep. Try giving the feeds two set times of day rather than the gaps between things.';
  }
  if (weekdays.length >= 3 && avg((d) => d.switchRate) > 12) {
    return 'The week was hoppy. Try closing everything but one window for the first hour of two mornings.';
  }
  return 'Nothing to fix, which is its own result. Keep the shape of this week and see if it holds.';
}
