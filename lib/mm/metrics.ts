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
 * THE LANGUAGE RULE. Every string in this file is read by someone looking at
 * their own screen time, not by an analyst. So: short sentences, everyday
 * words, and no term that needs a glossary.
 *
 * That applies to the metric NAMES too, which is where it was hardest and
 * mattered most. "Fragmentation" is a fine word for what it measures and a
 * terrible name for a thing on a phone screen — nobody looks at it and knows
 * what it means. It is Jumpiness. "Intentionality" is On Plan. "Visual Load"
 * is Eyes. "Recovery" is Rest, "Strain" is Effort. The ids underneath keep the
 * original terms, so the code still reads precisely; only the label changes,
 * because the label is the part a person has to understand. "How often you jumped away", not
 * "context switches per engaged hour". "Time after 11pm", not "late-night
 * exposure". Where a technical idea genuinely earns its place — the 20-minute
 * cost of getting back on task — it gets explained in the same breath rather
 * than assumed. A metric nobody can read is not transparent, whatever is
 * printed underneath it.
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
  fitness: { optimal: 'Great', solid: 'Good', watch: 'Okay', strained: 'Rough' },
  focus: { optimal: 'Sharp', solid: 'Steady', watch: 'Patchy', strained: 'All over' },
  recovery: { optimal: 'Well rested', solid: 'Okay', watch: 'Not much', strained: 'Worn out' },
  strain: { optimal: 'Easy', solid: 'Normal', watch: 'Hard', strained: 'Very hard' },
  visual: { optimal: 'Fine', solid: 'Okay', watch: 'Tired', strained: 'Very tired' },
  fragmentation: { optimal: 'Calm', solid: 'Mostly calm', watch: 'Jumpy', strained: 'Very jumpy' },
  intentionality: { optimal: 'Went to plan', solid: 'Close', watch: 'Drifted', strained: 'Off plan' },
};

interface Draft {
  id: MetricId;
  label: string;
  /** The metric in ordinary words. Shown under the name, never instead of it. */
  plain: string;
  /** The one real-units measurement this score is mostly about. */
  fact: string;
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
    plain: draft.plain,
    fact: draft.fact,
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
      label: 'Time in long blocks',
      value: `${Math.round(focusShare)}%`,
      score: clamp(focusShare * 1.4, 0, 100),
      weight: 0.34,
      provenance: 'derived',
      detail:
        'How much of your screen time sat inside a block of 25 minutes or more with nothing breaking it up. A busy day can still score low here — that is the whole point of it.',
    },
    {
      label: 'Longest block',
      value: fmtMin(d.longestBoutMin),
      score: rampInverse(d.longestBoutMin, 60),
      weight: 0.26,
      provenance: 'measured',
      detail:
        'Your longest run without a break. An hour is full marks — past that you gain little and your eyes and back start paying for it.',
    },
    {
      label: 'Long blocks today',
      value: String(d.deepBouts),
      score: rampInverse(d.deepBouts, 3),
      weight: 0.22,
      provenance: 'measured',
      detail:
        'Blocks of 25 minutes or more. Three is a full day — one is luck, three is a rhythm.',
    },
    {
      label: 'Interruptions inside them',
      value: deep.length ? interruptionsPerDeepBout.toFixed(1) : '—',
      score: deep.length ? 100 - ramp(interruptionsPerDeepBout, 2, 14) : undefined,
      weight: deep.length ? 0.18 : undefined,
      provenance: deep.length ? 'measured' : 'unavailable',
      detail:
        'Times you nipped away and came back mid-block. A block that survived twelve of those was long, but you were not really in it.',
    },
  ];

  return assemble(
    {
      id: 'focus',
      label: 'Focus',
      plain: 'How long you stuck with one thing',
      fact: `${fmtMin(d.longestBoutMin)} best run`,
      polarity: 'higher-better',
      provenance: 'derived',
      inputs,
      headline: (v) =>
        d.activeMin < 15
          ? 'Not enough time on screen yet to tell.'
          : v >= 75
            ? `You stayed with things. ${d.deepBouts === 1 ? 'One long block' : `${d.deepBouts} long blocks`}, the best one ${fmtMin(d.longestBoutMin)}.`
            : v >= 55
              ? `Steady day. ${fmtMiles(d.miles.focus)} of your ${fmtMiles(d.miles.total)} miles were focus miles.`
              : v >= 35
                ? 'Patchy. Plenty of screen time, but few runs long enough to get anywhere.'
                : 'All over the place. Almost nothing today lasted long enough to land.',
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
  /*
   * The published figure for getting back to full concentration after an
   * interruption is around 23 minutes. Multiplying it by the day's jumps
   * routinely produces a number larger than the day itself — which is not a
   * bug in the arithmetic but a bug in presenting it as hours. Nobody pays the
   * full price every time, and "31.1h" printed under a 6-hour day reads as
   * broken maths rather than as a striking fact. So past the length of the day
   * it stops being a duration and becomes the sentence it was always meant to
   * be.
   */
  const refocusDebtMin = d.switches * 23;
  const refocusOverflows = refocusDebtMin > d.activeMin && d.activeMin > 0;

  const inputs: MetricInput[] = [
    {
      label: 'Jumps away, per hour',
      value: d.switchRate > 0 ? d.switchRate.toFixed(1) : '—',
      score: d.switchRate > 0 ? ramp(d.switchRate, 6, 45) : undefined,
      weight: d.switchRate > 0 ? 0.38 : undefined,
      provenance: d.switchRate > 0 ? 'measured' : 'unavailable',
      detail:
        'Every time you left what you were doing and came back. Getting your head fully back into something takes about 23 minutes, so a few jumps an hour is a very different day from thirty.',
    },
    {
      label: 'Quick check-ins',
      value: `${d.shortBouts} of ${sessions}`,
      score: sessions > 0 ? ramp(shortShare, 15, 70) : undefined,
      weight: sessions > 0 ? 0.24 : undefined,
      provenance: 'measured',
      detail:
        'Visits under five minutes — too short to be doing anything. This is checking rather than using, and it is what turns hours into nothing much.',
    },
    {
      label: 'Times you came back',
      value: String(sessions),
      score: sessions > 0 ? ramp(sessions, 6, 40) : undefined,
      weight: sessions > 0 ? 0.2 : undefined,
      provenance: 'measured',
      detail: 'How many separate visits you made to the screen. A big number means the day got chopped up.',
    },
    {
      label: 'Average visit',
      value: sessions > 0 ? fmtMin(meanBout) : '—',
      score: sessions > 0 ? ramp(Math.max(0, 30 - meanBout), 5, 28) : undefined,
      weight: sessions > 0 ? 0.18 : undefined,
      provenance: 'derived',
      detail: 'Your screen time shared out across those visits. Half an hour each is a calm day.',
    },
    {
      label: 'Getting back on track',
      value: refocusOverflows ? 'more than the day itself' : fmtMin(refocusDebtMin),
      provenance: 'estimated',
      detail: refocusOverflows
        ? 'Every jump costs you about 23 minutes to get your head fully back in. Today you jumped away so often that those add up to more time than the day contained — which mostly means you never got all the way back before the next one. It does not affect your score.'
        : 'Every jump costs about 23 minutes to get your head fully back in. This is those added up. Not time you literally lost — nobody pays full price every time — just a sense of the size of it. It does not affect your score.',
    },
  ];

  return assemble(
    {
      id: 'fragmentation',
      label: 'Jumpiness',
      plain: 'How much you hopped about',
      fact: d.switchRate > 0 ? `${Math.round(d.switchRate)} jumps an hour` : 'no jumps yet',
      polarity: 'lower-better',
      provenance: 'derived',
      inputs,
      headline: (v) =>
        d.activeMin < 15
          ? 'Not enough time on screen yet to tell.'
          : v < 25
            ? `Calm day. ${sessions} visits, about ${fmtMin(meanBout)} each.`
            : v < 50
              ? 'Mostly calm — you picked the screen up a few more times than you needed to.'
              : v < 75
                ? `Jumpy. ${d.shortBouts} of your ${sessions} visits lasted under five minutes.`
                : 'Very jumpy. Almost nothing today got a clear run.',
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
      label: 'Time on screen',
      value: fmtMin(d.activeMin),
      score: ramp(d.activeMin, 180, 660),
      weight: 0.26,
      provenance: d.loggedMin > 0 ? 'derived' : 'measured',
      detail:
        d.loggedMin > 0
          ? `${fmtMin(d.measuredMin)} counted here, plus ${fmtMin(d.loggedMin)} you added yourself. Three hours is an ordinary working day; eleven is the top of the scale.`
          : 'Time you were actually using the screen — looking at it, and touching it. A tab left open while you make lunch does not count. Three hours is an ordinary working day; eleven is the top of the scale.',
    },
    {
      label: 'Longest stretch without a break',
      value: fmtMin(d.longestBoutMin),
      score: ramp(d.longestBoutMin, 45, 180),
      weight: 0.18,
      provenance: 'measured',
      detail: 'The same hours taken in pieces cost you less than taken in one go.',
    },
    {
      label: 'How busy your hands were',
      value: `${density.toFixed(0)} /min`,
      score: ramp(density, 60, 320),
      weight: 0.14,
      provenance: 'derived',
      detail:
        'Typing and tapping per minute. This is about how hard you were working, not how long for.',
    },
    {
      label: 'Fast scrolling',
      value: fmtMin(d.burstMin),
      score: ramp(d.burstMin, 10, 120),
      weight: 0.14,
      provenance: 'measured',
      detail:
        'Minutes where things went past faster than you could read them. Easy to do, and more tiring than it feels.',
    },
    {
      label: 'Jumping between things',
      value: d.switchRate > 0 ? `${d.switchRate.toFixed(1)} /h` : '—',
      score: ramp(d.switchRate, 8, 45),
      weight: 0.14,
      provenance: 'measured',
      detail: 'Jumping about tires you out on its own, even on a short day.',
    },
    {
      label: 'Time after 11pm',
      value: fmtMin(d.lateNightMin),
      score: ramp(d.lateNightMin, 10, 120),
      weight: 0.14,
      provenance: 'measured',
      detail:
        'This costs more than the same time at midday, because it comes out of your sleep rather than out of your day.',
    },
  ];

  return assemble(
    {
      id: 'strain',
      label: 'Effort',
      plain: 'How hard the day was',
      fact: `${fmtMin(d.activeMin)} on screen`,
      polarity: 'lower-better',
      provenance: 'derived',
      inputs,
      headline: (v) =>
        d.activeMin < 15
          ? 'Barely anything today.'
          : v < 25
            ? `An easy day. ${fmtMin(d.activeMin)} on screen, taken in manageable pieces.`
            : v < 50
              ? `A normal working day — ${fmtMin(d.activeMin)} on screen.`
              : v < 75
                ? `A hard day. ${fmtMin(d.activeMin)} on screen, longest run ${fmtMin(d.longestBoutMin)}.`
                : 'A very hard day. You will probably feel this one tomorrow.',
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
function visualMetric(
  d: DaySummary,
  brightness: { known: boolean; measured: boolean },
  baseline?: Baseline,
): Metric {
  const breaksPerHour = d.activeMin > 30 ? d.breakCount / (d.activeMin / 60) : 0;
  const breakDeficit = Math.max(0, 1.5 - breaksPerHour);
  const eveningExposure = (d.avgBrightness / 100) * d.nightMin;

  const inputs: MetricInput[] = [
    {
      label: 'Longest look without a break',
      value: fmtMin(d.longestBoutMin),
      score: ramp(d.longestBoutMin, UNBROKEN_BOUT_MIN, 150),
      weight: 0.28,
      provenance: 'measured',
      detail:
        'The usual advice is: every 20 minutes, look at something far away for 20 seconds. Staring at something close up is what tires eyes — and you blink about half as often while you do it.',
    },
    {
      label: 'Screen time altogether',
      value: fmtMin(d.activeMin),
      score: ramp(d.activeMin, 120, 600),
      weight: 0.24,
      provenance: 'derived',
      detail: 'All of it added up, across the whole day.',
    },
    {
      label: 'Breaks per hour',
      value: d.activeMin > 30 ? `${breaksPerHour.toFixed(1)} /h` : '—',
      score: d.activeMin > 30 ? ramp(breakDeficit, 0.4, 1.5) : undefined,
      weight: d.activeMin > 30 ? 0.18 : undefined,
      provenance: d.activeMin > 30 ? 'measured' : 'unavailable',
      detail: `Breaks of ${RECOVERY_MIN} minutes or more. About one and a half an hour is the target.`,
    },
    {
      label: brightness.known ? 'Evening screen, and how bright' : 'Evening screen brightness',
      value: brightness.known ? `${fmtMin(d.nightMin)} at ${d.avgBrightness}%` : "Can't read it",
      /*
       * Dropped outright when brightness is unknown. `assemble` spreads its
       * weight over the inputs that remain, so the score is built only from
       * things actually observed — rather than quietly folding in a default
       * nobody supplied, which is what happens when a metric treats "no data"
       * as "middling".
       */
      score: brightness.known ? (d.nightMin > 20 ? ramp(eveningExposure, 15, 180) : 0) : undefined,
      weight: brightness.known ? 0.16 : undefined,
      provenance: brightness.known ? (brightness.measured ? 'measured' : 'estimated') : 'unavailable',
      detail: brightness.measured
        ? 'Evening time, weighted by how bright it actually is where you are — read from your device’s light sensor. A bright screen in a dark room is the hardest combination for your eyes.'
        : brightness.known
          ? 'Evening time, weighted by the brightness you set yourself. No web browser can read screen brightness, so this part is your figure rather than ours.'
          : 'No web browser can read screen brightness on any device, and yours has no light sensor we can use. So this is left out of the score entirely instead of being guessed at. Your evening screen time still counts through the inputs above.',
    },
    {
      label: 'Fast-moving stuff',
      value: fmtMin(d.burstMin),
      score: ramp(d.burstMin, 10, 100),
      weight: 0.14,
      provenance: 'measured',
      detail: 'Minutes of fast scrolling. Chasing something that keeps moving is more tiring than reading something that sits still.',
    },
  ];

  return assemble(
    {
      id: 'visual',
      label: 'Eyes',
      plain: 'How tired your eyes got',
      fact: `${fmtMin(d.nightMin)} evening screen`,
      polarity: 'lower-better',
      // With a real sensor reading this is arithmetic on observed values. With a
      // figure the user typed it is an estimate. With neither, brightness is
      // simply not part of it, and the rest is derived as normal.
      provenance: brightness.measured || !brightness.known ? 'derived' : 'estimated',
      inputs,
      headline: (v) =>
        d.activeMin < 15
          ? 'Not enough screen time today to say.'
          : v < 25
            ? 'Easy day for your eyes. Your breaks are doing their job.'
            : v < 50
              ? `Okay. Your longest look without a break was ${fmtMin(d.longestBoutMin)}.`
              : v < 75
                ? `Your eyes worked hard. ${fmtMin(d.longestBoutMin)} without a break, and ${d.breakCount === 1 ? 'only one break' : `only ${d.breakCount} breaks`} all day.`
                : 'Your eyes worked very hard. This is the shape of a day that ends with a headache.',
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
      label: 'Breaks you took',
      value: d.activeMin > 30 ? `${d.breakCount} breaks · ${breaksPerHour.toFixed(1)}/h` : `${d.breakCount} breaks`,
      score: d.activeMin > 30 ? rampInverse(breaksPerHour, 1.5) : undefined,
      weight: d.activeMin > 30 ? 0.26 : undefined,
      provenance: d.activeMin > 30 ? 'measured' : 'unavailable',
      detail: `Gaps of ${RECOVERY_MIN} minutes or more. Shorter pauses are real, but they do not put anything back.`,
    },
    {
      label: 'Longest time away',
      value: fmtMin(d.longestBreakMin),
      score: rampInverse(d.longestBreakMin, 90),
      weight: 0.2,
      provenance: 'measured',
      detail:
        'Your biggest gap between visits. An hour and a half is full marks. Time before you started and after you finished does not count — that is not a break you took.',
    },
    {
      label: 'Evening left alone',
      value: fmtMin(d.lateNightMin),
      score: 100 - ramp(d.lateNightMin, 10, 120),
      weight: 0.22,
      provenance: 'measured',
      detail:
        'Time after 11pm — less is better. Light this late pushes your body clock back and makes sleep come later, so this matters more than anything else here.',
    },
    {
      label: 'Did you let up?',
      value: fmtMin(d.longestBoutMin),
      score: 100 - ramp(d.longestBoutMin, 45, 180),
      weight: 0.16,
      provenance: 'measured',
      detail: 'Your longest stretch, flipped round — shorter is better here. A day that never lets up never recovers, however short it was.',
    },
    {
      label: 'How hoppy the day was',
      value: String(Math.round(fragmentation)),
      score: 100 - fragmentation,
      weight: 0.16,
      provenance: 'derived',
      detail:
        'Your Jumpiness score, flipped. A hoppy day leaves you more tired than a long calm one — which is why it counts against your rest, not just your effort.',
    },
  ];

  return assemble(
    {
      id: 'recovery',
      label: 'Rest',
      plain: 'How much of a break you got',
      fact: d.breakCount === 1 ? '1 break taken' : `${d.breakCount} breaks taken`,
      polarity: 'higher-better',
      provenance: 'derived',
      inputs,
      headline: (v) =>
        d.activeMin < 15
          ? 'A day almost entirely off screens. Nothing to recover from.'
          : v >= 75
            ? `Well rested. ${d.breakCount === 1 ? 'One proper break' : `${d.breakCount} proper breaks`}, and you left the evening alone.`
            : v >= 55
              ? 'Enough rest to get by, without much to spare.'
              : v >= 35
                ? `Not much rest. ${d.breakCount === 0 ? 'No break reached ten minutes.' : `Only ${d.breakCount} real breaks in ${fmtMin(d.activeMin)}.`}`
                : 'Worn out. A long day, few breaks, and the evening went on the screen too.',
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
      label: 'On Plan',
      plain: 'Did the day go how you wanted',
      fact: 'nothing planned',
      value: 0,
      polarity: 'higher-better',
      band: 'watch',
      bandLabel: 'Nothing planned',
      provenance: 'unavailable',
      headline: 'Tell us what you want from a day and we can check how it went.',
      inputs: [
        {
          label: 'What you planned',
          value: 'Nothing yet',
          provenance: 'unavailable',
          detail:
            'This compares what you meant to do with what actually happened. With no plan there is nothing to compare — so you get no score rather than a zero, because you did not fail at anything.',
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
      detail: `You planned ${fmtMin(target)}. We match that against ${
        deepCats.includes(cat)
          ? 'your long focused blocks'
          : cat === 'recovery'
            ? 'your time away from the screen'
            : cat === 'communication'
              ? 'your shorter bits of screen time'
              : 'your fast-scrolling time'
      }, plus anything you added yourself.`,
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
      label: 'Plan you kept',
      value: `${fmtMin(met)} of ${fmtMin(plannedTotal)}`,
      score: adherence,
      weight: 0.75,
      provenance: 'estimated',
      detail: 'How much of what you planned actually happened. Doing extra of one thing does not make up for missing another.',
    },
    {
      label: 'Time that went elsewhere',
      value: fmtMin(unplannedScroll),
      score: 100 - clamp(driftShare * 2.2, 0, 100),
      weight: 0.25,
      provenance: 'estimated',
      detail: 'Fast scrolling beyond anything you planned for. Keeping the plan counts for less if the rest of the day went somewhere you did not choose.',
    },
    ...perCategory.map((i) => ({ ...i, score: undefined, weight: undefined })),
  ];

  return assemble(
    {
      id: 'intentionality',
      label: 'On Plan',
      plain: 'Did the day go how you wanted',
      fact: `${fmtMin(met)} of ${fmtMin(plannedTotal)}`,
      polarity: 'higher-better',
      provenance: 'estimated',
      inputs,
      headline: (v) =>
        v >= 75
          ? `It went to plan. You wanted ${fmtMin(plannedTotal)} and got ${fmtMin(met)} of it.`
          : v >= 55
            ? `Close. ${fmtMin(met)} of your ${fmtMin(plannedTotal)} plan happened.`
            : v >= 35
              ? `Drifted. ${fmtMin(unplannedScroll)} went somewhere you had not planned.`
              : 'Off plan. What you wanted and what happened were two different days.',
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
      detail: 'How well you stayed with things. It counts for the most, because it is what all the rest is for.',
    },
    {
      label: 'Recovery',
      value: String(parts.recovery.value),
      score: parts.recovery.value,
      weight: 0.22,
      provenance: 'derived',
      detail: 'How much rest you got. A hard day with no rest is not fitness, it just piles up.',
    },
    {
      label: 'Stayed on track',
      value: String(100 - parts.fragmentation.value),
      score: 100 - parts.fragmentation.value,
      weight: 0.2,
      provenance: 'derived',
      detail: 'Your Jumpiness score, flipped round — so a calm day scores high here.',
    },
    {
      label: 'Hard day, handled well',
      value: `${parts.strain.value} hard vs ${parts.recovery.value} rested`,
      score: balance,
      weight: 0.12,
      provenance: 'derived',
      detail:
        'Only the bit where the day was harder than your rest counts against you. A hard day you rested from costs you nothing here — which is exactly why this app does not just reward using your phone less.',
    },
    {
      label: 'Easy on the eyes',
      value: String(100 - parts.visual.value),
      score: 100 - parts.visual.value,
      weight: 0.12,
      provenance: 'estimated',
      detail: 'Your Eyes score, flipped. It counts for less because part of it rests on a brightness you told us rather than one we measured.',
    },
    {
      label: 'Intentionality',
      value: intentionalityAvailable ? String(parts.intentionality.value) : 'Nothing planned',
      score: intentionalityAvailable ? parts.intentionality.value : undefined,
      weight: intentionalityAvailable ? 0.1 : undefined,
      provenance: intentionalityAvailable ? 'estimated' : 'unavailable',
      detail: intentionalityAvailable
        ? 'How closely the day matched what you wanted from it.'
        : 'You did not plan anything today, so this is left out altogether and its share is spread over the others — rather than scored as a zero you did not earn.',
    },
  ];

  return assemble(
    {
      id: 'fitness',
      label: 'Screen Fitness',
      plain: 'How well you handled your screen time',
      fact: 'your last 7 days',
      polarity: 'higher-better',
      provenance: 'derived',
      inputs,
      headline: (v) =>
        d.activeMin < 15
          ? 'Barely any screen time today — not enough to score.'
          : v >= 75
            ? 'A great day. You took it on, and you rested from it.'
            : v >= 55
              ? `A good day. ${[parts.focus, parts.recovery, parts.fragmentation].sort((a, b) => (a.polarity === 'higher-better' ? a.value : 100 - a.value) - (b.polarity === 'higher-better' ? b.value : 100 - b.value))[0].label} is the weakest part of it.`
              : v >= 35
                ? 'An okay day. The pieces were there but it did not quite hold together.'
                : 'A rough day. Long hours, little rest, attention all over the place.',
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
  opts: {
    baseline?: Baseline;
    /** Whether a brightness figure exists at all, and whether it was measured. */
    brightness?: { known: boolean; measured: boolean };
  } = {},
): DayReport {
  const { baseline, brightness = { known: false, measured: false } } = opts;

  const focus = focusMetric(summary, baseline);
  const fragmentation = fragmentationMetric(summary, baseline);
  const strain = strainMetric(summary, baseline);
  const visual = visualMetric(summary, brightness, baseline);
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
