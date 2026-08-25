import type { Baseline } from './baseline';
import { DEEP_BOUT_MIN } from './aggregate';
import { fmtMin, plural } from './format';
import type {
  ChallengeDef,
  ChallengeEnrollment,
  ChallengeProgress,
  DayReport,
  Profile,
} from './types';

/**
 * CHALLENGES.
 *
 * Three rules govern every challenge here.
 *
 * They are written the way you would say them out loud. "Do a fifth less fast
 * scrolling" rather than "reduce rapid-scroll minutes by 20% against baseline".
 * Somebody deciding whether to start one should not have to decode it first.
 *
 * None of them are about using devices less. "Reclaim three hours" is measured
 * against the user's own baseline, so a person with a nine-hour working day can
 * win it; "spend under two hours on your phone" would only ever be winnable by
 * people whose jobs already allowed it, which makes it a description of
 * someone's circumstances rather than an achievement.
 *
 * And none of them are guilt-shaped. There is no streak to break, no penalty
 * for a bad day, and no challenge you can fail — only ones that run out of
 * days. A challenge you are behind on says how far behind, and stops there.
 */

export const CHALLENGES: ChallengeDef[] = [
  {
    id: 'seven-day-reclaim',
    name: '7-Day Reclaim',
    premise: 'Win back three hours on a normal week for you.',
    criterion: 'Save up three hours over seven days, compared with how you normally spend them.',
    days: 7,
    accent: 'record',
  },
  {
    id: 'deep-work-5',
    name: 'Deep Work 5',
    premise: 'Five proper blocks. An hour each, nothing breaking them up.',
    criterion: 'Do five separate hour-long stretches with no interruptions inside them.',
    days: 14,
    accent: 'focus',
  },
  {
    id: 'scroll-down',
    name: 'Scroll Down',
    premise: 'Do a fifth less fast scrolling.',
    criterion: 'Over seven days, average 20% less fast scrolling per day than you normally do.',
    days: 7,
    accent: 'scatter',
  },
  {
    id: 'digital-sunrise',
    name: 'Digital Sunrise',
    premise: 'Give the first half hour of the day to something else.',
    criterion: 'Five days where you barely touch a screen in the first hour after getting up.',
    days: 7,
    accent: 'recovery',
  },
  {
    id: 'digital-sunset',
    name: 'Digital Sunset',
    premise: 'Stop before your screens do.',
    criterion: 'Five days with no screen time after the hour you set as your cut-off.',
    days: 7,
    accent: 'recovery',
  },
  {
    id: 'fragmentation-breaker',
    name: 'Settle Down',
    premise: 'Jump between things 15% less than you normally do.',
    criterion: 'Over seven days, jump away 15% less per hour than you normally do.',
    days: 7,
    accent: 'focus',
  },
  {
    id: 'recovery-week',
    name: 'Recovery Week',
    premise: 'Seven days, three proper breaks each.',
    criterion: 'Seven days in a row with at least three breaks of ten minutes or more.',
    days: 7,
    accent: 'recovery',
  },
];

export const CHALLENGE_BY_ID: Record<string, ChallengeDef> = Object.fromEntries(
  CHALLENGES.map((c) => [c.id, c]),
);

interface EvalContext {
  /** Reports inside the challenge window, oldest first. */
  window: DayReport[];
  baseline: Baseline;
  profile: Profile;
  reclaimedMinutes: number;
}

/** Each evaluator returns progress 0–1 and a line stating where the user is. */
type Evaluator = (ctx: EvalContext) => { progress: number; detail: string };

const EVALUATORS: Record<string, Evaluator> = {
  'seven-day-reclaim': ({ reclaimedMinutes }) => ({
    progress: Math.min(1, reclaimedMinutes / 180),
    detail:
      reclaimedMinutes > 0
        ? `${fmtMin(reclaimedMinutes)} saved of 3h`
        : 'Nothing saved against your usual yet',
  }),

  'deep-work-5': ({ window }) => {
    const blocks = window.reduce(
      (n, r) => n + r.summary.bouts.filter((b) => b.endMin - b.startMin + 1 >= 60).length,
      0,
    );
    // Counted blocks are clamped for display: "41 of 5" is arithmetically true
    // and reads as a bug.
    return {
      progress: Math.min(1, blocks / 5),
      detail: `${Math.min(blocks, 5)} of 5 hour-long blocks`,
    };
  },

  'scroll-down': ({ window, baseline }) => {
    const measured = window.filter((r) => r.summary.activeMin >= 15);
    if (measured.length === 0) return { progress: 0, detail: 'No days measured yet' };
    const avg = measured.reduce((s, r) => s + r.summary.burstMin, 0) / measured.length;
    const normal = baseline.normal('burstMin', measured[measured.length - 1].date);
    if (!normal || normal.value < 3) {
      return { progress: 0, detail: 'Needs a few more days before we can compare' };
    }
    const target = normal.value * 0.8;
    // Progress is how far the gap has been closed, floored at zero — being
    // above baseline is not negative progress, it is simply no progress.
    const progress = Math.min(1, Math.max(0, (normal.value - avg) / Math.max(normal.value - target, 0.001)));
    return {
      progress,
      detail: `${fmtMin(avg)} a day · you usually do ${fmtMin(normal.value)} · aiming for ${fmtMin(target)}`,
    };
  },

  'digital-sunrise': ({ window }) => {
    const clean = window.filter((r) => !r.summary.partial && r.summary.sunriseMin < 5).length;
    return { progress: Math.min(1, clean / 5), detail: `${clean} of 5 clear mornings` };
  },

  'digital-sunset': ({ window, profile }) => {
    const clean = window.filter((r) => !r.summary.partial && r.summary.curfewMin < 1).length;
    return {
      progress: Math.min(1, clean / 5),
      detail: `${clean} of 5 evenings clear after ${String(profile.curfewHour).padStart(2, '0')}:00`,
    };
  },

  'fragmentation-breaker': ({ window, baseline }) => {
    const measured = window.filter((r) => r.summary.activeMin >= 60);
    if (measured.length === 0) return { progress: 0, detail: 'No full days measured yet' };
    const avg = measured.reduce((s, r) => s + r.summary.switchRate, 0) / measured.length;
    const normal = baseline.normal('switchRate', measured[measured.length - 1].date);
    if (!normal || normal.value < 1) {
      return { progress: 0, detail: 'Needs more baseline history to compare' };
    }
    const target = normal.value * 0.85;
    const progress = Math.min(1, Math.max(0, (normal.value - avg) / Math.max(normal.value - target, 0.001)));
    return {
      progress,
      detail: `${avg.toFixed(1)} an hour · you usually do ${normal.value.toFixed(1)} · aiming for ${target.toFixed(1)}`,
    };
  },

  'recovery-week': ({ window }) => {
    const good = window.filter((r) => !r.summary.partial && r.summary.breakCount >= 3).length;
    return { progress: Math.min(1, good / 7), detail: `${good} of 7 days with 3 or more breaks` };
  },
};

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00`).getTime();
  const b = new Date(`${toIso}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * Evaluate every challenge against the user's history.
 *
 * A challenge that is not joined still reports what its progress WOULD be, so
 * the card can show a real number before enrolment rather than an empty
 * promise. Joining just starts the clock.
 */
export function evaluateChallenges(
  reports: DayReport[],
  enrollments: Record<string, ChallengeEnrollment>,
  baseline: Baseline,
  profile: Profile,
  reclaimedMinutes: number,
  today: string,
): ChallengeProgress[] {
  const byDate = new Map(reports.map((r) => [r.date, r]));

  return CHALLENGES.map((def) => {
    const enrollment = enrollments[def.id];
    const start = enrollment?.startedOn ?? reports[Math.max(0, reports.length - def.days)]?.date ?? today;

    const window: DayReport[] = [];
    for (let i = 0; i < def.days; i++) {
      const d = new Date(`${start}T12:00:00`);
      d.setDate(d.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (key > today) break;
      const report = byDate.get(key);
      if (report) window.push(report);
    }

    const { progress, detail } = EVALUATORS[def.id]({ window, baseline, profile, reclaimedMinutes });
    const elapsed = daysBetween(start, today);
    const daysLeft = Math.max(0, def.days - elapsed - 1);

    let status: ChallengeProgress['status'];
    if (enrollment?.completedOn || (enrollment && progress >= 1)) status = 'complete';
    else if (!enrollment) status = 'available';
    else if (elapsed >= def.days) status = 'expired';
    else status = 'active';

    return {
      def,
      status,
      progress,
      detail:
        status === 'complete'
          ? 'Complete'
          : status === 'expired'
            ? `Time ran out at ${Math.round(progress * 100)}%`
            : detail,
      daysLeft: enrollment ? daysLeft : undefined,
      startedOn: enrollment?.startedOn,
      completedOn: enrollment?.completedOn,
    };
  });
}

/** Human-readable window length, for the challenge card. */
export function windowLabel(def: ChallengeDef): string {
  return plural(def.days, 'day');
}

export { DEEP_BOUT_MIN };
