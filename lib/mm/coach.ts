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
 *   person, and always in words the user would use themselves. "Your evening
 *   scrolling was up a third on your usual" is a fact. "You are spending too
 *   long on your phone" is a judgement, and it is not this product's to make.
 *
 *   It never needs a glossary. No sentence here uses a term the app has not
 *   already explained in ordinary words on the screen the reader came from.
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
      title: 'You focused better than usual today',
      evidence: `Your focus came in at ${today.focus.value}. On a normal day like this it is about ${Math.round(d.baseline)} — so ${fmtPercent(d.percent)}.`,
      action: 'Whatever kept your morning clear, put it in the diary for tomorrow before something else takes the slot.',
      because:
        'Focus comes from the shape of your day far more than from trying harder. So the thing worth copying is the day, not the effort.',
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
      evidence: `Less than ten minutes on a screen after 11pm, ${streak} days running.`,
      action: 'Nothing to change. This is the single habit that helps the most, and it is holding.',
      because:
        'Screen light late at night pushes your body clock back and makes sleep come later. A clear evening improves tomorrow before it has started.',
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
      title: `Later nights, ${plural(eveningRun, 'day')} in a row`,
      evidence: `${fmtMin(today.summary.lateNightMin)} on a screen after 11pm today${
        d && d.percent !== null ? `, ${fmtPercent(d.percent)} on your usual` : ''
      }.`,
      action: 'Pick a stopping time an hour before bed, and put the charger in another room tonight.',
      because:
        'Screen light in the evening makes sleep come later, even if you end up sleeping just as long. When you stop matters more than how long you were on.',
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
      title: 'More fast scrolling than usual',
      evidence: `${fmtMin(d)} of fast scrolling today. You usually do about ${fmtMin(normal.value)} — so ${fmtPercent(((d - normal.value) / normal.value) * 100)}.`,
      action:
        eveningShare > 0.35
          ? 'Most of it was in the evening. Try finishing half an hour earlier tonight.'
          : 'Try keeping it to two set times of day, rather than letting it fill the gaps between things.',
      because:
        'Fast scrolling means things went past quicker than you could read them. It is the clearest sign of time passing without you getting anything from it.',
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
      title: 'Today got chopped up',
      evidence: `${today.summary.shortBouts} of your ${today.summary.bouts.length} visits lasted under five minutes, and you jumped away ${today.summary.switchRate.toFixed(1)} times an hour${
        mean !== null ? `. Lately you average ${Math.round(mean)} out of 100 here` : ''
      }.`,
      action: 'Keep one 45-minute block clear tomorrow — notifications off, nothing else open. One is enough to change the shape of a day.',
      because:
        'It takes about 23 minutes to get your head fully back into something. A day of five-minute visits never reaches the part where hard things get solved.',
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
      title: 'A long run with barely a break',
      evidence: `${fmtMin(today.summary.longestBoutMin)} without stopping, and ${
        today.summary.breakCount === 0 ? 'no break reached ten minutes' : 'only one break did'
      }.`,
      action: 'Stand up at the end of the next hour, even for thirty seconds, and look at something across the room while you are up.',
      because:
        'You blink about half as often while staring at a screen, which is what makes eyes feel dry and gritty. Standing up sorts out the stiffness at the same time.',
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
      title: `You do your best work around ${fmtTimeOfDay(best.hour * 60)}`,
      evidence: `Looking back over your days, ${fmtRange(best.hour * 60, best.hour * 60 + 59)} holds more focused time than any other hour.`,
      action: `Try keeping ${fmtRange(best.hour * 60, best.hour * 60 + 119)} free tomorrow, with notifications off.`,
      because:
        'When you do something matters more than how hard you try at it. Moving the work usually beats pushing harder.',
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
      evidence: `${fmtMin(today.summary.sunriseMin)} on a screen in the first hour after you got up.`,
      action: 'Try giving the first half hour to something else, and see whether the rest of the morning feels different.',
      because:
        'How you start tends to set the pace for the rest. A jumpy first half hour usually means a jumpy day.',
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
      title: 'You have not told us what you want today',
      evidence: 'With no plan set, there is nothing to compare the day against.',
      action: 'Set one thing for tomorrow — even a single 90-minute block of work is enough to make the comparison worth something.',
      because:
        'Hours on a screen tell you almost nothing on their own. The gap between what you meant to do and what you did is where the useful bit is.',
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
      ? 'Not much on screen yet today. This page fills in as the day goes on.'
      : 'Almost nothing happened on screen this day.';
  }

  const parts: string[] = [];

  const activeDelta = baseline.delta('activeMin', s.activeMin, 'lower-better', today.date);
  const kind = new Date(`${today.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
  parts.push(
    activeDelta && activeDelta.percent !== null && Math.abs(activeDelta.percent) >= 8
      ? `You spent ${fmtMin(s.activeMin)} actually using a screen — ${fmtPercent(activeDelta.percent)} on a normal ${kind} for you.`
      : `You spent ${fmtMin(s.activeMin)} actually using a screen, about the same as a normal ${kind} for you.`,
  );

  const longest = [...s.bouts].sort((a, b) => b.endMin - b.startMin - (a.endMin - a.startMin))[0];
  if (longest && longest.endMin - longest.startMin + 1 >= 25) {
    parts.push(
      `Your best run was ${fmtRange(longest.startMin, longest.endMin)} — ${fmtMin(longest.endMin - longest.startMin + 1)} without a break.`,
    );
  }

  if (s.miles.scroll > 0.5) {
    parts.push(
      `${fmtMin(s.miles.scroll * 20)} of that went on fast scrolling.`,
    );
  } else if (s.breakCount > 0) {
    parts.push(`You took ${plural(s.breakCount, 'proper break')} of ten minutes or more.`);
  }

  return parts.join(' ');
}
