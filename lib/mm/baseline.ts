import { isWeekend, median } from './format';
import type { BaselineDelta, DaySummary, Metric, MetricId } from './types';

/**
 * YOU VERSUS YOU.
 *
 * Every comparison in this product is against the user's own history. There are
 * no population averages anywhere, for two reasons. The obvious one is that
 * they would require sending behaviour off the device. The better one is that
 * they are meaningless: a developer's Tuesday and a nurse's Tuesday have no
 * business being scored on the same curve, and the moment you tell someone they
 * are "above average" you have replaced a useful signal with a social one.
 *
 * Baselines are MEDIANS, not means. One fourteen-hour travel day, one weekend
 * with a deadline, and a mean-based normal is wrong for a fortnight. A median
 * absorbs that and keeps describing the user's actual ordinary day.
 *
 * Weekdays and weekends are baselined separately, because for most people they
 * are different behaviours rather than the same behaviour with noise.
 */

/** How far back a baseline looks. Four weeks: long enough to be stable, recent enough to be current. */
export const BASELINE_WINDOW = 28;

/** Below this many comparable days there is no honest normal, and the UI says so. */
export const MIN_BASELINE_DAYS = 4;

/** Every field a baseline can be taken over. */
export type BaselineField =
  | 'activeMin'
  | 'totalMiles'
  | 'focusMiles'
  | 'scatterMiles'
  | 'scrollMiles'
  | 'recoveryMiles'
  | 'longestBoutMin'
  | 'deepBouts'
  | 'shortBouts'
  | 'switchRate'
  | 'breakCount'
  | 'lateNightMin'
  | 'curfewMin'
  | 'nightMin'
  | 'scrollPx'
  | 'burstMin'
  | MetricId;

interface Sample {
  date: string;
  weekend: boolean;
  values: Partial<Record<BaselineField, number>>;
}

function sampleOf(summary: DaySummary, metrics?: Record<MetricId, Metric>): Sample {
  const values: Partial<Record<BaselineField, number>> = {
    activeMin: summary.activeMin,
    totalMiles: summary.miles.total,
    focusMiles: summary.miles.focus,
    scatterMiles: summary.miles.scatter,
    scrollMiles: summary.miles.scroll,
    recoveryMiles: summary.miles.recovery,
    longestBoutMin: summary.longestBoutMin,
    deepBouts: summary.deepBouts,
    shortBouts: summary.shortBouts,
    switchRate: summary.switchRate,
    breakCount: summary.breakCount,
    lateNightMin: summary.lateNightMin,
    curfewMin: summary.curfewMin,
    nightMin: summary.nightMin,
    scrollPx: summary.scrollPx,
    burstMin: summary.burstMin,
  };
  if (metrics) {
    for (const [id, m] of Object.entries(metrics)) {
      values[id as MetricId] = m.value;
    }
  }
  return { date: summary.date, weekend: isWeekend(summary.date), values };
}

export class Baseline {
  private samples: Sample[];

  private constructor(samples: Sample[]) {
    this.samples = samples;
  }

  /**
   * Build from completed days only.
   *
   * Partial days are excluded on purpose: a day measured up to 11am has a
   * genuinely low mileage, and letting it into the baseline would drag every
   * "normal" down and then congratulate the user for beating it.
   *
   * Days with almost no activity are excluded too — a day the device was not
   * used is not a low-usage day, it is an absence of data, and the difference
   * matters when the product's headline number is time reclaimed.
   */
  static from(
    summaries: DaySummary[],
    metricsByDate?: Record<string, Record<MetricId, Metric>>,
  ): Baseline {
    const usable = summaries
      .filter((s) => !s.partial && s.activeMin >= 15)
      .slice(-BASELINE_WINDOW)
      .map((s) => sampleOf(s, metricsByDate?.[s.date]));
    return new Baseline(usable);
  }

  /** Days behind a baseline for the given kind of day. */
  countFor(date: string): number {
    return this.cohort(date).length;
  }

  /**
   * The comparable cohort for a date: same kind of day when there is enough of
   * it, otherwise every day, so a new user gets a rough normal rather than
   * nothing at all. Which of the two was used is reported through `samples`.
   */
  private cohort(date: string): Sample[] {
    const weekend = isWeekend(date);
    const matched = this.samples.filter((s) => s.weekend === weekend && s.date !== date);
    if (matched.length >= MIN_BASELINE_DAYS) return matched;
    return this.samples.filter((s) => s.date !== date);
  }

  /** The user's normal for a field, or null when there is not enough history. */
  normal(field: BaselineField, date: string): { value: number; samples: number } | null {
    const cohort = this.cohort(date);
    const values = cohort
      .map((s) => s.values[field])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (values.length < MIN_BASELINE_DAYS) {
      return values.length ? { value: median(values), samples: values.length } : null;
    }
    return { value: median(values), samples: values.length };
  }

  /** True once there is enough history for comparisons to be worth showing. */
  ready(date: string): boolean {
    return this.countFor(date) >= MIN_BASELINE_DAYS;
  }

  /**
   * Compare a value against the user's normal.
   *
   * `polarity` decides what counts as better, so the caller never has to
   * remember whether up is good for this particular number — Fragmentation
   * falling and Focus rising are both improvements, and both come back with
   * `better: true`.
   */
  delta(
    field: BaselineField,
    value: number,
    polarity: 'higher-better' | 'lower-better',
    date: string,
  ): BaselineDelta | undefined {
    const n = this.normal(field, date);
    if (!n) return undefined;

    const change = value - n.value;
    // Percentages against a near-zero baseline are noise dressed as insight.
    const percent = Math.abs(n.value) > 0.5 ? (change / n.value) * 100 : null;
    const better = polarity === 'higher-better' ? change >= 0 : change <= 0;

    return { baseline: n.value, change, percent, better, samples: n.samples };
  }
}

/**
 * Consecutive days, ending today or yesterday, on which the user met a
 * condition. Used for the profile streak.
 *
 * The streak deliberately survives a single missing day of DATA at the end —
 * not using a device is not a broken streak. This product does not punish
 * absence, because absence is frequently the goal.
 */
export function streakOf(
  summaries: DaySummary[],
  predicate: (s: DaySummary) => boolean,
): number {
  const ordered = [...summaries].sort((a, b) => (a.date < b.date ? 1 : -1));
  let streak = 0;
  for (const s of ordered) {
    if (s.partial && !predicate(s)) continue; // today still has time to qualify
    if (s.activeMin < 15) continue; // a day away is not a day failed
    if (!predicate(s)) break;
    streak += 1;
  }
  return streak;
}
