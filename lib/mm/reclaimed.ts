import type { Baseline } from './baseline';
import { MIN_BASELINE_DAYS } from './baseline';
import { fmtMin } from './format';
import type { DaySummary, Reclaimed } from './types';

/**
 * RECLAIMED TIME.
 *
 * The product's headline number, and the one place the framing matters more
 * than the arithmetic.
 *
 * "You used your phone six hours less" is a report about deprivation. "6h 18m
 * reclaimed" is a report about what you got back. The measurement underneath is
 * identical; the difference is whether the user finishes the sentence feeling
 * like they lost something or gained something. This product picks the second,
 * because it is also the more accurate description of what happened.
 *
 * What counts as reclaimable is deliberately narrow. Only three things:
 *
 *   rapid-scroll minutes   content moving faster than it could be read
 *   fragmented minutes     time spent in sessions too short to go anywhere
 *   late-night minutes     time taken out of recovery
 *
 * Focus minutes are never counted as reclaimable, at all. A day where you did
 * four hours of hard work below your baseline has not reclaimed four hours —
 * it has done less work, which is a different fact and not this product's
 * business. Anything else would make the number reward avoidance.
 */

interface Component {
  key: 'scroll' | 'fragmented' | 'late';
  label: string;
  detail: string;
  of: (s: DaySummary) => number;
  baselineField: 'scrollMiles' | 'scatterMiles' | 'lateNightMin';
  /** Baselines held in miles need converting back to minutes. */
  scale: number;
}

const COMPONENTS: Component[] = [
  {
    key: 'scroll',
    label: 'Less recreational scrolling',
    detail: 'Minutes where content moved past faster than it could be read, below your normal for this kind of day.',
    of: (s) => s.miles.scroll * 20,
    baselineField: 'scrollMiles',
    scale: 20,
  },
  {
    key: 'fragmented',
    label: 'Fewer fragmented sessions',
    detail: 'Minutes spent in stretches too short to get anywhere, below your normal.',
    of: (s) => s.miles.scatter * 20,
    baselineField: 'scatterMiles',
    scale: 20,
  },
  {
    key: 'late',
    label: 'Fewer late-night sessions',
    detail: 'Minutes after 23:00, below your normal. Time returned to sleep rather than to the day.',
    of: (s) => s.lateNightMin,
    baselineField: 'lateNightMin',
    scale: 1,
  },
];

/**
 * Compute reclaimed time across a window.
 *
 * Each day is compared against the user's own normal for that kind of day, and
 * only days that came in BELOW baseline contribute. A day above baseline
 * contributes nothing — it does not subtract. That asymmetry is intentional:
 * this is a count of time won back, not a running balance, and a product whose
 * headline figure can go down because you had one heavy Thursday would be a
 * product nobody opens on Friday.
 */
export function reclaimedTime(summaries: DaySummary[], baseline: Baseline): Reclaimed {
  const usable = summaries.filter((s) => !s.partial && s.activeMin >= 15);

  if (usable.length === 0 || !usable.some((s) => baseline.countFor(s.date) >= MIN_BASELINE_DAYS)) {
    return {
      minutes: 0,
      days: usable.length,
      breakdown: [],
      available: false,
    };
  }

  const totals: Record<Component['key'], number> = { scroll: 0, fragmented: 0, late: 0 };

  for (const day of usable) {
    if (baseline.countFor(day.date) < MIN_BASELINE_DAYS) continue;
    for (const c of COMPONENTS) {
      const normal = baseline.normal(c.baselineField, day.date);
      if (!normal) continue;
      const normalMinutes = normal.value * c.scale;
      const actual = c.of(day);
      const saved = normalMinutes - actual;
      if (saved > 0) totals[c.key] += saved;
    }
  }

  const breakdown = COMPONENTS.map((c) => ({
    label: c.label,
    minutes: Math.round(totals[c.key]),
    detail: c.detail,
  })).filter((b) => b.minutes >= 1);

  return {
    minutes: Math.round(breakdown.reduce((s, b) => s + b.minutes, 0)),
    days: usable.length,
    breakdown,
    available: true,
  };
}

/** One line for the share card and the weekly review. */
export function reclaimedHeadline(r: Reclaimed): string {
  if (!r.available) return 'Building your baseline — reclaimed time appears once there is a normal to compare against.';
  if (r.minutes < 5) return 'Roughly level with your normal across this window.';
  return `${fmtMin(r.minutes)} reclaimed against your own baseline.`;
}
