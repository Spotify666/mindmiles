import type { Baseline } from './baseline';
import { DEEP_BOUT_MIN, RECOVERY_MIN, UNBROKEN_BOUT_MIN } from './aggregate';
import { clamp, fmtCount, fmtDistance, fmtMin, fmtMiles, ramp, rampInverse } from './format';
import type {
  Band,
  Category,
  DayReport,
  DaySummary,
  Metric,
  MetricId,
  MetricInput,
  Provenance,
} from './types';

/**
 * The metric layer.
 *
 * Seven numbers, and every one of them can be taken apart. Each metric carries
 * the full list of inputs that produced it, each input's own 0–100 contribution,
 * its weight, and where the underlying value came from. Tapping any score in the
 * UI shows exactly this — there is no hidden term anywhere in this file.
 *
 * Three rules were applied throughout:
 *
 *   Nothing is scored that is not measured. Where a browser cannot see a
 *   signal, the metric that would have used it says `unavailable` rather than
 *   quietly modelling it.
 *
 *   No threshold is invented to make a number move. Every constant is either
 *   published guidance (20-20-20, the ~23-minute refocus cost, evening light
 *   and melatonin) or a stated convention, and all of them appear on /method.
 *
 *   Load is not sin. Strain is reported as magnitude, not misconduct — a heavy
 *   day of real work should read as a heavy day, not a failure, which is why
 *   its bands are Light through Very high rather than Good through Bad.
 */

// ─────────────────────────── banding ───────────────────────────

function bandFor(value: number, polarity: 'higher-better' | 'lower-better'): Band {
  const good = polarity === 'higher-better' ? value : 100 - value;
  if (good >= 75) return 'optimal';
  if (good >= 55) return 'solid';
  if (good >= 35) return 'watch';
  return 'strained';
}

/** Each metric names its own bands, because "75" does not mean the same thing twice. */
const BAND_LABELS: Record<MetricId, Record<Band, string>> = {
  fitness: { optimal: 'Excellent', solid: 'Strong', watch: 'Building', strained: 'Low' },
  focus: { optimal: 'Deep', solid: 'Steady', watch: 'Shallow', strained: 'Scattered' },
  recovery: { optimal: 'Restored', solid: 'Adequate', watch: 'Thin', strained: 'Depleted' },
  strain: { optimal: 'Light', solid: 'Moderate', watch: 'High', strained: 'Very high' },
  visual: { optimal: 'Comfortable', solid: 'Noticeable', watch: 'Elevated', strained: 'Heavy' },
  fragmentation: { optimal: 'Whole', solid: 'Mostly intact', watch: 'Broken up', strained: 'Shredded' },
  intentionality: { optimal: 'On plan', solid: 'Close', watch: 'Drifting', strained: 'Off plan' },
};

interface Draft {
  id: MetricId;
  label: string;
  polarity: 'higher-better' | 'lower-better';
  provenance: Provenance;
  inputs: MetricInput[];
  headline: (value: number, band: Band) => string;
}

/**
 * Assemble a metric from its inputs.
 *
 * The weighted sum happens here and only here, so no metric can quietly apply
 * its own arithmetic. Weights are normalised rather than trusted, which means
 * dropping an input because its signal is unavailable redistributes its weight
 * across the rest instead of silently deflating the score.
 */
function assemble(draft: Draft, baseline?: Baseline, date?: string): Metric {
  const scored = draft.inputs.filter(
    (i) => typeof i.score === 'number' && typeof i.weight === 'number' && i.provenance !== 'unavailable',
  );
  const totalWeight = scored.reduce((s, i) => s + (i.weight ?? 0), 0);
  const value =
    totalWeight > 0
      ? Math.round(clamp(scored.reduce((s, i) => s + (i.score ?? 0) * (i.weight ?? 0), 0) / totalWeight, 0, 100))
      : 0;

  const band = bandFor(value, draft.polarity);

  return {
    id: draft.id,
    label: draft.label,
    value,
    polarity: draft.polarity,
    band,
    bandLabel: BAND_LABELS[draft.id][band],
    provenance: draft.provenance,
    headline: draft.headline(value, band),
    inputs: draft.inputs,
    delta: baseline && date ? baseline.delta(draft.id, value, draft.polarity, date) : undefined,
  };
}

// ─────────────────────────── FOCUS ───────────────────────────

/**
 * Attention held. The share of the day's mileage spent inside stretches long
 * enough to reach depth, how long the best of those ran, how many there were,
 * and whether they survived intact.
 */
function focusMetric(d: DaySummary, baseline?: Baseline): Metric {
  const focusShare = d.activeMin > 0 ? (d.miles.focus / Math.max(d.miles.total, 0.001)) * 100 : 0;

  const deep = d.bouts.filter((b) => b.endMin - b.startMin + 1 >= DEEP_BOUT_MIN);
  const interruptionsPerDeepBout = deep.length > 0 ? deep.reduce((s, b) => s + b.switches, 0) / deep.length : 0;

  const inputs: MetricInput[] = [
    {
      label: 'Focus share of mileage',
      value: `${Math.round(focusShare)}%`,
      score: clamp(focusShare * 1.4, 0, 100),
      weight: 0.34,
      provenance: 'derived',
      detail:
        'The proportion of engaged minutes that fell inside an uninterrupted stretch of 25 minutes or more. A day can be busy and still score low here — that is the distinction the metric exists to draw.',
    },
    {
      label: 'Longest unbroken stretch',
      value: fmtMin(d.longestBoutMin),
      score: rampInverse(d.longestBoutMin, 60),
      weight: 0.26,
      provenance: 'measured',
      detail:
        'The single longest run with no break. Scored against a 60-minute target, above which the marginal gain to depth is small and the cost to your eyes and back starts to dominate.',
    },
    {
      label: 'Deep blocks',
      value: String(d.deepBouts),
      score: rampInverse(d.deepBouts, 3),
      weight: 0.22,
      provenance: 'measured',
      detail:
        'Stretches of 25 minutes or more. Three is treated as a full day: one long block is fragile, three is a rhythm.',
    },
    {
      label: 'Interruptions inside deep blocks',
      value: deep.length ? interruptionsPerDeepBout.toFixed(1) : '—',
      score: deep.length ? 100 - ramp(interruptionsPerDeepBout, 2, 14) : undefined,
      weight: deep.length ? 0.18 : undefined,
      provenance: deep.length ? 'measured' : 'unavailable',
      detail:
        'Context switches that happened during a deep block without ending it. A block that survived twelve interruptions was long, but it was not deep.',
    },
  ];

  return assemble(
    {
      id: 'focus',
      label: 'Focus',
      polarity: 'higher-better',
      provenance: 'derived',
      inputs,
      headline: (v) =>
        d.activeMin < 15
          ? 'Not enough measured time yet to say anything about focus.'
          : v >= 75
            ? `Attention held. ${d.deepBouts === 1 ? 'One deep block' : `${d.deepBouts} deep blocks`}, longest ${fmtMin(d.longestBoutMin)}.`
            : v >= 55
              ? `Steady. ${fmtMiles(d.miles.focus)} of your ${fmtMiles(d.miles.total)} miles were focus miles.`
              : v >= 35
                ? 'Shallow. The day had engagement but few stretches long enough for depth.'
                : 'Scattered. Almost nothing today ran long enough to get anywhere.',
    },
    baseline,
    d.date,
  );
}

// ─────────────────────── FRAGMENTATION ───────────────────────

/**
 * How often attention changed target. This is the metric the product is really
 * built around: two people with identical screen time and wildly different days
 * differ here more than anywhere else.
 */
function fragmentationMetric(d: DaySummary, baseline?: Baseline): Metric {
  const sessions = d.bouts.length;
  const meanBout = sessions > 0 ? d.activeMin / sessions : 0;
  const shortShare = sessions > 0 ? (d.shortBouts / sessions) * 100 : 0;
  const refocusDebtHours = (d.switches * 23) / 60;

  const inputs: MetricInput[] = [
    {
      label: 'Context switches per engaged hour',
      value: d.switchRate > 0 ? d.switchRate.toFixed(1) : '—',
      score: d.switchRate > 0 ? ramp(d.switchRate, 6, 45) : undefined,
      weight: d.switchRate > 0 ? 0.38 : undefined,
      provenance: d.switchRate > 0 ? 'measured' : 'unavailable',
      detail:
        'Every time attention left this context and came back. The classic attention research puts the cost of returning to full depth at around 23 minutes, which is why a handful of switches an hour is a different day from thirty.',
    },
    {
      label: 'Sessions under 5 minutes',
      value: `${d.shortBouts} of ${sessions}`,
      score: sessions > 0 ? ramp(shortShare, 15, 70) : undefined,
      weight: sessions > 0 ? 0.24 : undefined,
      provenance: 'measured',
      detail:
        'Sessions too short to have been going anywhere. This is the signature of checking rather than using — the pattern that produces hours with nothing to show for them.',
    },
    {
      label: 'Separate sessions',
      value: String(sessions),
      score: sessions > 0 ? ramp(sessions, 6, 40) : undefined,
      weight: sessions > 0 ? 0.2 : undefined,
      provenance: 'measured',
      detail: 'How many times you re-entered the screen. High counts mean the day was shredded rather than spent.',
    },
    {
      label: 'Average session length',
      value: sessions > 0 ? fmtMin(meanBout) : '—',
      score: sessions > 0 ? ramp(Math.max(0, 30 - meanBout), 5, 28) : undefined,
      weight: sessions > 0 ? 0.18 : undefined,
      provenance: 'derived',
      detail: 'Engaged time divided by session count, scored against a 30-minute mark.',
    },
    {
      label: 'Theoretical refocus debt',
      value: `${refocusDebtHours.toFixed(1)}h`,
      provenance: 'estimated',
      detail:
        'Switch count multiplied by the 23-minute refocus figure. Not literal lost hours — nobody pays the full cost every time — but a sense of scale for what fragmentation buys you. It carries no weight in the score.',
    },
  ];

  return assemble(
    {
      id: 'fragmentation',
      label: 'Fragmentation',
      polarity: 'lower-better',
      provenance: 'derived',
      inputs,
      headline: (v) =>
        d.activeMin < 15
          ? 'Not enough measured time yet to judge fragmentation.'
          : v < 25
            ? `Attention stayed whole. ${sessions} sessions, averaging ${fmtMin(meanBout)}.`
            : v < 50
              ? 'Mostly intact — a few more entry points than the day needed.'
              : v < 75
                ? `Broken up. ${d.shortBouts} of ${sessions} sessions lasted under five minutes.`
                : 'Shredded. Almost no window today survived long enough to be useful.',
    },
    baseline,
    d.date,
  );
}

// ─────────────────────────── STRAIN ───────────────────────────

/**
 * Total digital load — the WHOOP-strain analogue. Deliberately neutral: high
 * strain on a day of hard, chosen work is a correct reading, not a rebuke. It
 * only becomes a problem in relation to recovery, which is where Digital
 * Fitness weighs the two against each other.
 */
function strainMetric(d: DaySummary, baseline?: Baseline): Metric {
  const density = d.activeMin > 0 ? (d.keys + d.clicks * 8) / d.activeMin : 0;

  const inputs: MetricInput[] = [
    {
      label: 'Engaged time',
      value: fmtMin(d.activeMin),
      score: ramp(d.activeMin, 180, 660),
      weight: 0.26,
      provenance: d.loggedMin > 0 ? 'derived' : 'measured',
      detail:
        d.loggedMin > 0
          ? `${fmtMin(d.measuredMin)} measured here plus ${fmtMin(d.loggedMin)} you logged by hand. Three hours is treated as an ordinary working load; eleven as the ceiling.`
          : 'Active minutes with the page visible, focused, and input inside the idle window. Three hours is treated as an ordinary working load; eleven as the ceiling.',
    },
    {
      label: 'Longest continuous stretch',
      value: fmtMin(d.longestBoutMin),
      score: ramp(d.longestBoutMin, 45, 180),
      weight: 0.18,
      provenance: 'measured',
      detail: 'Sustained load without release. The same total time taken in pieces costs less than taken in one run.',
    },
    {
      label: 'Interaction density',
      value: `${density.toFixed(0)} /min`,
      score: ramp(density, 60, 320),
      weight: 0.14,
      provenance: 'derived',
      detail:
        'Keystrokes plus weighted clicks per engaged minute. A proxy for how hard the day was being worked, not how long it was.',
    },
    {
      label: 'Rapid scrolling',
      value: fmtMin(d.burstMin),
      score: ramp(d.burstMin, 10, 120),
      weight: 0.14,
      provenance: 'measured',
      detail:
        'Minutes where content moved past faster than it could be read. Cheap to do and surprisingly expensive to sustain.',
    },
    {
      label: 'Context switching',
      value: d.switchRate > 0 ? `${d.switchRate.toFixed(1)} /h` : '—',
      score: ramp(d.switchRate, 8, 45),
      weight: 0.14,
      provenance: 'measured',
      detail: 'Switching carries its own load independent of how long the day was.',
    },
    {
      label: 'Late-night use',
      value: fmtMin(d.lateNightMin),
      score: ramp(d.lateNightMin, 10, 120),
      weight: 0.14,
      provenance: 'measured',
      detail:
        'Minutes after 23:00. Load taken here costs more than the same load at midday, because it is taken out of recovery rather than out of the day.',
    },
  ];

  return assemble(
    {
      id: 'strain',
      label: 'Strain',
      polarity: 'lower-better',
      provenance: 'derived',
      inputs,
      headline: (v) =>
        d.activeMin < 15
          ? 'Barely any load measured today.'
          : v < 25
            ? `Light load. ${fmtMin(d.activeMin)} engaged, taken in manageable pieces.`
            : v < 50
              ? `Moderate load — a normal working day at ${fmtMin(d.activeMin)} engaged.`
              : v < 75
                ? `High load. ${fmtMin(d.activeMin)} engaged, longest run ${fmtMin(d.longestBoutMin)}.`
                : `Very high load. This is a day that will be felt tomorrow.`,
    },
    baseline,
    d.date,
  );
}

// ───────────────────────── VISUAL LOAD ─────────────────────────

/**
 * Estimated visual workload. This is a behavioural estimate and is labelled as
 * one everywhere: it describes how hard the day asked your eyes to work, and it
 * is not, and cannot be, a statement about your eyes. No clinical claim is made
 * anywhere in this metric.
 */
function visualMetric(d: DaySummary, brightnessMeasured: boolean, baseline?: Baseline): Metric {
  const breaksPerHour = d.activeMin > 30 ? d.breakCount / (d.activeMin / 60) : 0;
  const breakDeficit = Math.max(0, 1.5 - breaksPerHour);
  const eveningExposure = (d.avgBrightness / 100) * d.nightMin;

  const inputs: MetricInput[] = [
    {
      label: 'Longest continuous exposure',
      value: fmtMin(d.longestBoutMin),
      score: ramp(d.longestBoutMin, UNBROKEN_BOUT_MIN, 150),
      weight: 0.28,
      provenance: 'measured',
      detail:
        'The 20-20-20 guideline — every 20 minutes, 20 seconds at something 20 feet away. Fixed near-focus is what fatigues the ciliary muscle, and blink rate falls by more than half while it lasts.',
    },
    {
      label: 'Total exposure',
      value: fmtMin(d.activeMin),
      score: ramp(d.activeMin, 120, 600),
      weight: 0.24,
      provenance: 'derived',
      detail: 'Cumulative near-focus across the whole day.',
    },
    {
      label: 'Break rhythm',
      value: d.activeMin > 30 ? `${breaksPerHour.toFixed(1)} /h` : '—',
      score: d.activeMin > 30 ? ramp(breakDeficit, 0.4, 1.5) : undefined,
      weight: d.activeMin > 30 ? 0.18 : undefined,
      provenance: d.activeMin > 30 ? 'measured' : 'unavailable',
      detail: `Breaks of ${RECOVERY_MIN} minutes or more, per engaged hour, scored against a target of 1.5.`,
    },
    {
      label: 'Evening brightness exposure',
      value: `${fmtMin(d.nightMin)} at ${d.avgBrightness}%`,
      score: d.nightMin > 20 ? ramp(eveningExposure, 15, 180) : 0,
      weight: 0.16,
      provenance: brightnessMeasured ? 'measured' : 'estimated',
      detail: brightnessMeasured
        ? 'Evening minutes weighted by real display brightness. A bright screen in a dark room is what makes the iris work hardest.'
        : 'Evening minutes weighted by the brightness you declared. No browser can read display brightness, so this input is an estimate — it is the reason the whole metric is marked estimated.',
    },
    {
      label: 'Rapid content change',
      value: fmtMin(d.burstMin),
      score: ramp(d.burstMin, 10, 100),
      weight: 0.14,
      provenance: 'measured',
      detail: 'Minutes of fast scrolling. Continuously re-fixating on moving content is more tiring than reading still text.',
    },
  ];

  return assemble(
    {
      id: 'visual',
      label: 'Visual Load',
      polarity: 'lower-better',
      // Brightness is the input that decides this: without a real reading the
      // whole metric is an estimate, and says so rather than implying a measurement.
      provenance: brightnessMeasured ? 'derived' : 'estimated',
      inputs,
      headline: (v) =>
        d.activeMin < 15
          ? 'Too little screen time today to estimate visual load.'
          : v < 25
            ? 'Comfortable. Your break rhythm is doing its job.'
            : v < 50
              ? `Noticeable. Longest continuous stretch was ${fmtMin(d.longestBoutMin)}.`
              : v < 75
                ? `Elevated. ${fmtMin(d.longestBoutMin)} unbroken, with ${d.breakCount === 1 ? 'one break' : `${d.breakCount} breaks`} across the day.`
                : 'Heavy. This is the shape of a day that ends with a headache.',
    },
    baseline,
    d.date,
  );
}

// ───────────────────────── RECOVERY ─────────────────────────

/** Capacity restored: breaks taken, evenings protected, load released. */
function recoveryMetric(d: DaySummary, fragmentation: number, baseline?: Baseline): Metric {
  const breaksPerHour = d.activeMin > 30 ? d.breakCount / (d.activeMin / 60) : 0;

  const inputs: MetricInput[] = [
    {
      label: 'Break frequency',
      value: d.activeMin > 30 ? `${d.breakCount} breaks · ${breaksPerHour.toFixed(1)}/h` : `${d.breakCount} breaks`,
      score: d.activeMin > 30 ? rampInverse(breaksPerHour, 1.5) : undefined,
      weight: d.activeMin > 30 ? 0.26 : undefined,
      provenance: d.activeMin > 30 ? 'measured' : 'unavailable',
      detail: `Gaps of ${RECOVERY_MIN} minutes or more between sessions. Shorter pauses are real but are not recovery.`,
    },
    {
      label: 'Longest screen-free window',
      value: fmtMin(d.longestBreakMin),
      score: rampInverse(d.longestBreakMin, 90),
      weight: 0.2,
      provenance: 'measured',
      detail:
        'The longest continuous gap inside your active day, scored against 90 minutes. Time before your first session and after your last is excluded — that is not a break you took, it is a day you had not started.',
    },
    {
      label: 'Evening protection',
      value: fmtMin(d.lateNightMin),
      score: 100 - ramp(d.lateNightMin, 10, 120),
      weight: 0.22,
      provenance: 'measured',
      detail:
        'Minutes after 23:00, inverted. This is the window where light most strongly delays melatonin and pushes the body clock later, so it is the most consequential single input here.',
    },
    {
      label: 'Load released',
      value: fmtMin(d.longestBoutMin),
      score: 100 - ramp(d.longestBoutMin, 45, 180),
      weight: 0.16,
      provenance: 'measured',
      detail: 'Longest unbroken stretch, inverted. A day with no release does not recover regardless of its total.',
    },
    {
      label: 'Attention cost',
      value: String(Math.round(fragmentation)),
      score: 100 - fragmentation,
      weight: 0.16,
      provenance: 'derived',
      detail:
        'Fragmentation, inverted. A shredded day leaves you more tired than a long one, which is why it belongs in recovery rather than only in strain.',
    },
  ];

  return assemble(
    {
      id: 'recovery',
      label: 'Recovery',
      polarity: 'higher-better',
      provenance: 'derived',
      inputs,
      headline: (v) =>
        d.activeMin < 15
          ? 'A day almost entirely off screens. Nothing to recover from.'
          : v >= 75
            ? `Restored. ${d.breakCount === 1 ? 'One meaningful break' : `${d.breakCount} meaningful breaks`} and a protected evening.`
            : v >= 55
              ? 'Adequate. Enough release to hold, without much margin.'
              : v >= 35
                ? `Thin. ${d.breakCount === 0 ? 'No break reached ten minutes.' : `Only ${d.breakCount} real breaks across ${fmtMin(d.activeMin)}.`}`
                : 'Depleted. Long load, few breaks, and the evening was not protected.',
    },
    baseline,
    d.date,
  );
}

// ─────────────────────── INTENTIONALITY ───────────────────────

/**
 * Did the day match what you said you wanted from it?
 *
 * A browser cannot see which application a minute belonged to, so delivery is
 * matched against what IS measurable — focus minutes, scroll minutes, recovery
 * windows, and any session logged by hand with a category on it. That is an
 * inference, so the metric is marked estimated and never presented as though
 * the product knew what you were doing.
 *
 * With no intentions set, it returns `unavailable` rather than a zero. A metric
 * that scores you against a plan you never made is not measuring anything.
 */
function intentionalityMetric(d: DaySummary, baseline?: Baseline): Metric {
  const planned = Object.entries(d.intents).filter(([, v]) => (v ?? 0) > 0) as [Category, number][];
  const plannedTotal = planned.reduce((s, [, v]) => s + v, 0);

  if (plannedTotal === 0) {
    return {
      id: 'intentionality',
      label: 'Intentionality',
      value: 0,
      polarity: 'higher-better',
      band: 'watch',
      bandLabel: 'Not set',
      provenance: 'unavailable',
      headline: 'Set an intention for the day and this becomes measurable.',
      inputs: [
        {
          label: 'Intentions set',
          value: 'None',
          provenance: 'unavailable',
          detail:
            'Intentionality compares what you planned against what the day actually contained. With nothing planned there is nothing to compare, so no score is shown — rather than a zero, which would imply you failed at something you never attempted.',
        },
      ],
    };
  }

  // What the day actually delivered, in the only terms this device can observe.
  const focusMin = d.miles.focus * 20;
  const scrollMin = d.miles.scroll * 20;
  const scatterMin = d.miles.scatter * 20;
  const recoveryMin = d.breaks.reduce((s, b) => s + b.minutes, 0);
  const loggedByCategory = new Map<Category, number>();
  for (const b of d.bouts) {
    if (b.source === 'logged' && b.category) {
      loggedByCategory.set(b.category, (loggedByCategory.get(b.category) ?? 0) + b.activeMin);
    }
  }

  const DELIVERED: Record<Category, number> = {
    work: focusMin,
    study: focusMin,
    creativity: focusMin,
    reading: focusMin,
    communication: scatterMin,
    social: scrollMin,
    entertainment: scrollMin,
    recovery: recoveryMin,
  };

  // Deep-work categories share the same pool of focus minutes, so the pool is
  // split across however many of them were planned. Otherwise planning "work"
  // and "study" would let one block satisfy both.
  const deepCats: Category[] = ['work', 'study', 'creativity', 'reading'];
  const plannedDeep = planned.filter(([c]) => deepCats.includes(c)).length || 1;

  let met = 0;
  const perCategory: MetricInput[] = planned.map(([cat, target]) => {
    const pool = deepCats.includes(cat) ? DELIVERED[cat] / plannedDeep : DELIVERED[cat];
    const delivered = pool + (loggedByCategory.get(cat) ?? 0);
    const hit = Math.min(delivered, target);
    met += hit;
    return {
      label: `${cat[0].toUpperCase()}${cat.slice(1)}`,
      value: `${fmtMin(delivered)} of ${fmtMin(target)}`,
      score: clamp((delivered / target) * 100, 0, 100),
      weight: target / plannedTotal,
      provenance: 'estimated',
      detail: `Planned ${fmtMin(target)}. Matched against ${
        deepCats.includes(cat)
          ? 'measured focus minutes'
          : cat === 'recovery'
            ? 'measured screen-free windows'
            : cat === 'communication'
              ? 'measured shallow-session minutes'
              : 'measured rapid-scroll minutes'
      }, plus anything you logged by hand in this category.`,
    };
  });

  const adherence = (met / plannedTotal) * 100;
  // Time that went nowhere you planned. The plan is not just what you wanted to
  // do — it is implicitly what you did not.
  const unplannedScroll = planned.some(([c]) => c === 'social' || c === 'entertainment')
    ? Math.max(0, scrollMin - (d.intents.social ?? 0) - (d.intents.entertainment ?? 0))
    : scrollMin;
  const driftShare = d.activeMin > 0 ? (unplannedScroll / d.activeMin) * 100 : 0;

  const inputs: MetricInput[] = [
    {
      label: 'Plan met',
      value: `${fmtMin(met)} of ${fmtMin(plannedTotal)}`,
      score: adherence,
      weight: 0.75,
      provenance: 'estimated',
      detail: 'How much of what you planned the day actually contained. Over-delivery is capped at the plan, so a runaway day cannot buy back a missed one.',
    },
    {
      label: 'Unplanned drift',
      value: fmtMin(unplannedScroll),
      score: 100 - clamp(driftShare * 2.2, 0, 100),
      weight: 0.25,
      provenance: 'estimated',
      detail: 'Rapid-scroll minutes beyond anything you planned for. Meeting the plan matters less if the rest of the day went somewhere you did not choose.',
    },
    ...perCategory.map((i) => ({ ...i, score: undefined, weight: undefined })),
  ];

  return assemble(
    {
      id: 'intentionality',
      label: 'Intentionality',
      polarity: 'higher-better',
      provenance: 'estimated',
      inputs,
      headline: (v) =>
        v >= 75
          ? `On plan. You intended ${fmtMin(plannedTotal)} and the day delivered ${fmtMin(met)} of it.`
          : v >= 55
            ? `Close. ${fmtMin(met)} of your ${fmtMin(plannedTotal)} plan landed.`
            : v >= 35
              ? `Drifting. ${fmtMin(unplannedScroll)} went somewhere you had not planned for.`
              : 'Off plan. What you intended and what happened were largely different days.',
    },
    baseline,
    d.date,
  );
}

// ────────────────────── DIGITAL FITNESS ──────────────────────

/**
 * The composite. Not an average of the others — a weighted judgement about
 * whether the day's load was carried well.
 *
 * The interesting term is Load balance. Strain does not subtract on its own,
 * because a hard day of chosen work is not a worse day. It only costs you where
 * it exceeded what you recovered: a strain of 80 against a recovery of 80 is a
 * strong day, and the same strain against a recovery of 30 is not.
 */
function fitnessMetric(
  d: DaySummary,
  parts: { focus: Metric; recovery: Metric; fragmentation: Metric; visual: Metric; strain: Metric; intentionality: Metric },
  baseline?: Baseline,
): Metric {
  const balance = 100 - clamp(parts.strain.value - parts.recovery.value, 0, 100);
  const intentionalityAvailable = parts.intentionality.provenance !== 'unavailable';

  const inputs: MetricInput[] = [
    {
      label: 'Focus',
      value: String(parts.focus.value),
      score: parts.focus.value,
      weight: 0.24,
      provenance: 'derived',
      detail: 'Attention held, weighted highest because it is the thing the rest is in service of.',
    },
    {
      label: 'Recovery',
      value: String(parts.recovery.value),
      score: parts.recovery.value,
      weight: 0.22,
      provenance: 'derived',
      detail: 'Capacity restored. Load without recovery is not fitness, it is accumulation.',
    },
    {
      label: 'Attention intact',
      value: String(parts.fragmentation.value),
      score: 100 - parts.fragmentation.value,
      weight: 0.2,
      provenance: 'derived',
      detail: 'Fragmentation, inverted.',
    },
    {
      label: 'Load balance',
      value: `strain ${parts.strain.value} vs recovery ${parts.recovery.value}`,
      score: balance,
      weight: 0.12,
      provenance: 'derived',
      detail:
        'Only the amount by which strain exceeded recovery counts against you. A heavy day you recovered from costs nothing here — which is the whole reason this product does not simply reward using devices less.',
    },
    {
      label: 'Visual comfort',
      value: String(parts.visual.value),
      score: 100 - parts.visual.value,
      weight: 0.12,
      provenance: 'estimated',
      detail: 'Visual Load, inverted. Weighted modestly because it rests on declared brightness.',
    },
    {
      label: 'Intentionality',
      value: intentionalityAvailable ? String(parts.intentionality.value) : 'Not set',
      score: intentionalityAvailable ? parts.intentionality.value : undefined,
      weight: intentionalityAvailable ? 0.1 : undefined,
      provenance: intentionalityAvailable ? 'estimated' : 'unavailable',
      detail: intentionalityAvailable
        ? 'How closely the day matched your plan.'
        : 'No intentions set today, so this term is dropped and its weight is spread across the others rather than scored as a zero.',
    },
  ];

  return assemble(
    {
      id: 'fitness',
      label: 'Digital Fitness',
      polarity: 'higher-better',
      provenance: 'derived',
      inputs,
      headline: (v) =>
        d.activeMin < 15
          ? 'Barely any measured activity today — not enough to score.'
          : v >= 75
            ? 'A strong day. Load carried well and recovered from.'
            : v >= 55
              ? `Solid. ${[parts.focus, parts.recovery, parts.fragmentation].sort((a, b) => (a.polarity === 'higher-better' ? a.value : 100 - a.value) - (b.polarity === 'higher-better' ? b.value : 100 - b.value))[0].label} is carrying the least weight.`
              : v >= 35
                ? 'Building. The pieces are there but the day did not hold together.'
                : 'Low. Long load, thin recovery, fragmented attention.',
    },
    baseline,
    d.date,
  );
}

// ─────────────────────────── entry point ───────────────────────────

/**
 * Build the full report for one day.
 *
 * Order matters: fragmentation feeds recovery, and both feed fitness. Nothing
 * else is interdependent, and nothing reads a value it did not receive.
 */
export function buildDayReport(
  summary: DaySummary,
  opts: { baseline?: Baseline; brightnessMeasured?: boolean } = {},
): DayReport {
  const { baseline, brightnessMeasured = false } = opts;

  const focus = focusMetric(summary, baseline);
  const fragmentation = fragmentationMetric(summary, baseline);
  const strain = strainMetric(summary, baseline);
  const visual = visualMetric(summary, brightnessMeasured, baseline);
  const recovery = recoveryMetric(summary, fragmentation.value, baseline);
  const intentionality = intentionalityMetric(summary, baseline);
  const fitness = fitnessMetric(
    summary,
    { focus, recovery, fragmentation, visual, strain, intentionality },
    baseline,
  );

  return {
    date: summary.date,
    summary,
    fitness,
    focus,
    recovery,
    strain,
    visual,
    fragmentation,
    intentionality,
    byId: { fitness, focus, recovery, strain, visual, fragmentation, intentionality },
  };
}

/**
 * Digital Fitness as a STATUS rather than a score for one day.
 *
 * A single day is too noisy to describe someone's relationship with technology,
 * so the headline figure is an exponentially weighted mean over the last seven
 * days — recent days matter more, but one rough Tuesday cannot erase a good
 * week. This is the number shown on the Today screen and the share card.
 */
export function fitnessStatus(reports: DayReport[], halfLifeDays = 3): number | null {
  const usable = reports.filter((r) => r.summary.activeMin >= 15).slice(-7);
  // No measured days means no status. Returning 0 would render as a terrible
  // score for someone who simply has no history yet.
  if (usable.length === 0) return null;

  let weighted = 0;
  let weight = 0;
  const newest = usable.length - 1;
  for (let i = 0; i < usable.length; i++) {
    const age = newest - i;
    const w = Math.pow(0.5, age / halfLifeDays);
    weighted += usable[i].fitness.value * w;
    weight += w;
  }
  return Math.round(weighted / Math.max(weight, 0.0001));
}

/** Total mileage across a set of days, used for weekly and monthly readouts. */
export function totalMileage(summaries: DaySummary[]) {
  return summaries.reduce(
    (acc, s) => ({
      total: acc.total + s.miles.total,
      focus: acc.focus + s.miles.focus,
      scatter: acc.scatter + s.miles.scatter,
      scroll: acc.scroll + s.miles.scroll,
      recovery: acc.recovery + s.miles.recovery,
    }),
    { total: 0, focus: 0, scatter: 0, scroll: 0, recovery: 0 },
  );
}

/** Formatted scroll distance for a set of days. Always labelled estimated in the UI. */
export function totalScroll(summaries: DaySummary[]): string {
  return fmtDistance(summaries.reduce((s, d) => s + d.scrollMeters, 0));
}

export { fmtCount };
