import type { Baseline } from './baseline';
import { fmtMin, fmtPercent, fmtRange, fmtTimeOfDay, plural } from './format';
import type { DayReport, Insight, Profile } from './types';

/**
 * THE COACH.
 *
 * Rules, not vibes. Every insight below is produced by a condition over
 * measured values, states the measurement that triggered it, and says what
 * follows from it. None of them fire on a hunch, and none of them are generic
 * wellness advice with a number stapled on.
 *
 * Three constraints shaped this file:
 *
 *   It never diagnoses. Nothing here says you have eye strain, poor sleep, or
 *   an attention problem. It says what was measured and what usually helps.
 *
 *   It never shames. The tone rule is simple — describe the behaviour, not the
 *   person, and always in a sentence the user could have written themselves.
 *   "Your evening scrolling rose 32% above your baseline" is a fact. "You are
 *   spending too long on your phone" is a judgement, and it is not this
 *   product's to make.
 *
 *   It always explains itself. Every insight carries a `because` — the reason
 *   the recommendation follows from the evidence. A coach that says what to do
 *   without saying why is just a notification.
 *
 * Insights are ranked and the Today screen shows exactly one, because a list of
 * nine things to fix is a list nobody acts on.
 */

interface Ctx {
  today: DayReport;
  history: DayReport[];
  baseline: Baseline;
  profile: Profile;
}

type Rule = (ctx: Ctx) => Insight | null;

/** Mean of a metric across the most recent `n` measured days, excluding today. */
function recentMean(history: DayReport[], pick: (r: DayReport) => number, n = 7): number | null {
  const usable = history.filter((r) => !r.summary.partial && r.summary.activeMin >= 15).slice(-n);
  if (usable.length === 0) return null;
  return usable.reduce((s, r) => s + pick(r), 0) / usable.length;
}

/** Consecutive most-recent completed days satisfying a condition. */
function runOf(history: DayReport[], test: (r: DayReport) => boolean): number {
  let n = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i];
    if (r.summary.partial) continue;
    if (r.summary.activeMin < 15) continue;
    if (!test(r)) break;
    n += 1;
  }
  return n;
}

const RULES: Rule[] = [
  // ── wins first: an improvement noticed is worth more than a fault found ──

  ({ today, baseline }) => {
    const d = today.focus.delta;
    if (!d || !d.better || (d.percent ?? 0) < 15 || today.summary.activeMin < 90) return null;
    if (!baseline.ready(today.date)) return null;
    return {
      id: 'focus-up',
      priority: 10,
      tone: 'win',
      title: 'Your focus is up on your own normal',
      evidence: `Focus scored ${today.focus.value} against a baseline of ${Math.round(d.baseline)} for this kind of day — ${fmtPercent(d.percent)}.`,
      action: 'Whatever protected the morning, put it in the diary for tomorrow before anything else claims the slot.',
      because:
        'Focus is the least durable of these metrics — it responds to conditions rather than to intent, so the useful move is to repeat the conditions.',
      accent: 'focus',
    };
  },

  ({ today, history }) => {
    const streak = runOf(history, (r) => r.summary.lateNightMin < 10);
    if (streak < 3 || today.summary.lateNightMin >= 10) return null;
    return {
      id: 'evening-streak',
      priority: 12,
      tone: 'win',
      title: `${plural(streak, 'clear evening')} in a row`,
      evidence: `Under ten minutes after 23:00 on each of the last ${streak} days.`,
      action: 'Nothing to change. This is the habit with the largest downstream effect, and it is holding.',
      because:
        'Light after 23:00 delays melatonin and pushes the body clock later, so a protected evening improves the next day before it starts.',
      accent: 'recovery',
    };
  },

  // ── then the things worth watching ──

  ({ today, history, baseline }) => {
    const eveningRun = runOf(history, (r) => r.summary.lateNightMin > 25);
    if (eveningRun < 3) return null;
    const d = baseline.delta('lateNightMin', today.summary.lateNightMin, 'lower-better', today.date);
    return {
      id: 'late-night-rising',
      priority: 2,
      tone: 'watch',
      title: `Late-night use has climbed for ${plural(eveningRun, 'day')}`,
      evidence: `${fmtMin(today.summary.lateNightMin)} after 23:00 today${
        d && d.percent !== null ? `, ${fmtPercent(d.percent)} against your normal` : ''
      }.`,
      action: 'Pick a hard stop 60 minutes before you intend to sleep, and put the charger in another room tonight.',
      because:
        'Evening light shifts sleep onset even when total sleep length is unchanged — the curfew matters more than the duration.',
      accent: 'recovery',
    };
  },

  ({ today, baseline }) => {
    const d = today.summary.burstMin;
    const normal = baseline.normal('burstMin', today.date);
    if (!normal || normal.value < 5 || d < normal.value * 1.25) return null;
    const eveningShare =
      today.summary.nightMin > 0 ? today.summary.nightMin / Math.max(today.summary.activeMin, 1) : 0;
    return {
      id: 'scroll-above-baseline',
      priority: 3,
      tone: 'watch',
      title: 'Rapid scrolling is above your normal',
      evidence: `${fmtMin(d)} of fast scrolling today against a baseline of ${fmtMin(normal.value)} — ${fmtPercent(((d - normal.value) / normal.value) * 100)}.`,
      action:
        eveningShare > 0.35
          ? 'Most of it landed in the evening. Try ending the final session half an hour earlier tonight.'
          : 'Batch feed-checking into two fixed windows rather than letting it fill the gaps between tasks.',
      because:
        'Rapid scrolling is measured as content moving faster than it can be read — it is the clearest signal of time passing without anything being taken from it.',
      accent: 'scatter',
    };
  },

  ({ today, history }) => {
    if (today.summary.activeMin < 120) return null;
    if (today.fragmentation.value < 55) return null;
    const mean = recentMean(history, (r) => r.fragmentation.value);
    return {
      id: 'fragmentation-high',
      priority: 4,
      tone: 'watch',
      title: 'The day came apart into pieces',
      evidence: `${today.summary.shortBouts} of ${today.summary.bouts.length} sessions ran under five minutes, at ${today.summary.switchRate.toFixed(1)} context switches an hour${
        mean !== null ? ` (your recent average is ${Math.round(mean)}/100 fragmentation)` : ''
      }.`,
      action: 'Protect one 45-minute block tomorrow with notifications off and nothing else open. One is enough to change the shape of a day.',
      because:
        'Returning to full depth after an interruption takes around 23 minutes, so a day of five-minute sessions never reaches the part where the hard problems get solved.',
      accent: 'focus',
    };
  },

  ({ today }) => {
    if (today.summary.activeMin < 90) return null;
    if (today.summary.longestBoutMin < 90) return null;
    if (today.summary.breakCount >= 2) return null;
    return {
      id: 'no-breaks',
      priority: 5,
      tone: 'watch',
      title: 'A long run with almost no release',
      evidence: `${fmtMin(today.summary.longestBoutMin)} unbroken, and ${
        today.summary.breakCount === 0 ? 'no break reached ten minutes' : 'only one break did'
      }.`,
      action: 'Stand up at the end of the next hour, even for thirty seconds, and look at something across the room while you do.',
      because:
        'The 20-20-20 guideline exists because blink rate falls by more than half during sustained near-focus, and standing resets most of the circulatory cost at the same time.',
      accent: 'strain',
    };
  },

  ({ today, history }) => {
    const best = history
      .filter((r) => !r.summary.partial && r.summary.activeMin >= 60)
      .reduce<{ hour: number; score: number } | null>((acc, r) => {
        // Which hour of the day most reliably contained focus minutes.
        const hours = new Array(24).fill(0);
        for (const [min, cls] of Object.entries(r.summary.minuteClass)) {
          if (cls === 'focus') hours[Math.floor(Number(min) / 60)] += 1;
        }
        const peak = hours.indexOf(Math.max(...hours));
        if (hours[peak] === 0) return acc;
        return !acc || hours[peak] > acc.score ? { hour: peak, score: hours[peak] } : acc;
      }, null);

    if (!best || history.length < 5) return null;
    if (today.summary.activeMin < 60) return null;
    return {
      id: 'peak-window',
      priority: 7,
      tone: 'steady',
      title: `Your deepest work lands around ${fmtTimeOfDay(best.hour * 60)}`,
      evidence: `Across your measured history, the hour from ${fmtRange(best.hour * 60, best.hour * 60 + 59)} holds more focus minutes than any other.`,
      action: `Try holding ${fmtRange(best.hour * 60, best.hour * 60 + 119)} tomorrow as a notification-free block.`,
      because:
        'Focus is far more schedule-dependent than effort-dependent, so the highest-return change is usually moving the work rather than trying harder at it.',
      accent: 'focus',
    };
  },

  ({ today, profile }) => {
    if (today.summary.sunriseMin < 25) return null;
    return {
      id: 'sunrise',
      priority: 8,
      tone: 'watch',
      title: 'The day started on a screen',
      evidence: `${fmtMin(today.summary.sunriseMin)} engaged in the first hour after ${String(profile.wakeHour).padStart(2, '0')}:00.`,
      action: 'Try giving the first thirty minutes to something else, and see whether the rest of the morning holds together differently.',
      because:
        'The first session of the day tends to set the switching rhythm for the ones after it — a fragmented start is unusually predictive of a fragmented day.',
      accent: 'scatter',
    };
  },

  ({ today }) => {
    if (today.intentionality.provenance !== 'unavailable') return null;
    if (today.summary.activeMin < 45) return null;
    return {
      id: 'set-intent',
      priority: 9,
      tone: 'steady',
      title: 'Nothing planned for today',
      evidence: 'No intentions were set, so intentionality is not being scored.',
      action: 'Set one intention for tomorrow — even a single 90-minute block of work is enough for the comparison to mean something.',
      because:
        'Total screen time says almost nothing on its own. The gap between what you meant to do and what happened is where the useful signal is.',
      accent: 'record',
    };
  },
];

/**
 * All insights that fire today, ranked. Lower priority number ranks higher —
 * problems worth acting on come before observations, and a genuine win outranks
 * both, because a product that only ever reports faults stops being read.
 */
export function coachInsights(ctx: Ctx): Insight[] {
  return RULES.map((r) => {
    try {
      return r(ctx);
    } catch {
      // A rule that throws on unusual data must not take the screen down with it.
      return null;
    }
  })
    .filter((i): i is Insight => i !== null)
    .sort((a, b) => a.priority - b.priority);
}

/** The single thing worth saying today. */
export function oneThing(ctx: Ctx): Insight | null {
  const all = coachInsights(ctx);
  // A win, if there is one, goes first — but never at the expense of something
  // genuinely worth acting on, which is what the priority numbers encode.
  return all[0] ?? null;
}

/**
 * The day's story: two or three sentences of plain description, no advice.
 * Deliberately separate from the insight rules — this says what happened,
 * they say what to do about it.
 */
export function dayStory(ctx: Ctx): string {
  const { today, baseline } = ctx;
  const s = today.summary;

  if (s.activeMin < 15) {
    return s.partial
      ? 'Barely any measured activity yet today. This page fills in as the day runs.'
      : 'Almost nothing measured on this day.';
  }

  const parts: string[] = [];

  const activeDelta = baseline.delta('activeMin', s.activeMin, 'lower-better', today.date);
  const kind = new Date(`${today.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
  parts.push(
    activeDelta && activeDelta.percent !== null && Math.abs(activeDelta.percent) >= 8
      ? `You spent ${fmtMin(s.activeMin)} in active digital interaction — ${fmtPercent(activeDelta.percent)} against your normal ${kind}.`
      : `You spent ${fmtMin(s.activeMin)} in active digital interaction, close to your normal ${kind}.`,
  );

  const longest = [...s.bouts].sort((a, b) => b.endMin - b.startMin - (a.endMin - a.startMin))[0];
  if (longest && longest.endMin - longest.startMin + 1 >= 25) {
    parts.push(
      `Your strongest stretch ran ${fmtRange(longest.startMin, longest.endMin)}, ${fmtMin(longest.endMin - longest.startMin + 1)} without a break.`,
    );
  }

  if (s.miles.scroll > 0.5) {
    parts.push(
      `${fmtMin(s.miles.scroll * 20)} went to rapid scrolling, out of ${fmtMin(s.activeMin)} total.`,
    );
  } else if (s.breakCount > 0) {
    parts.push(`You took ${plural(s.breakCount, 'break')} of ten minutes or more.`);
  }

  return parts.join(' ');
}
