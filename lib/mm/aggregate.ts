import { BURST_VELOCITY } from './tracker';
import { clamp, pxToMeters, toMiles } from './format';
import { DEFAULT_PROFILE } from './store';
import type {
  Bout,
  Category,
  DayRecord,
  DaySummary,
  ExternalSession,
  MinuteBucket,
  MinuteClass,
  Profile,
  RecoveryWindow,
} from './types';

/**
 * Raw minutes → a day.
 *
 * This file holds every threshold that turns measurement into meaning, in one
 * place, with the reasoning attached. Nothing here is tuned to make a number
 * look good; each constant is either a published figure or a stated convention,
 * and all of them are shown to the user on the Method page.
 */

/** A minute counts as engaged once it holds this much active time. */
const ENGAGED_MS = 20_000;

/** A gap this long or shorter is a pause inside a bout, not the end of one. */
const BOUT_GAP_MIN = 5;

/**
 * The length at which a stretch becomes capable of depth. Attention research
 * puts the return to full concentration after an interruption in the region of
 * twenty minutes, so a block shorter than about twenty-five rarely contains
 * much actual depth once the ramp-up is paid for.
 */
export const DEEP_BOUT_MIN = 25;

/** Under five minutes is the signature of a check, not a session. */
export const SHORT_BOUT_MIN = 5;

/** The 20-20-20 threshold: past this with no break is where eye strain accrues. */
export const UNBROKEN_BOUT_MIN = 20;

/** A gap this long between bouts is genuine recovery rather than a stretch of the legs. */
export const RECOVERY_MIN = 10;

/**
 * The most a single break can contribute to Recovery Miles.
 *
 * Without this cap, a day that starts at 09:00 and ends at 23:00 with two long
 * gaps banks ten hours of "recovery" and the number dwarfs everything else on
 * the screen. It would also be wrong: beyond about an hour away, additional
 * time is not additional recovery from the load that preceded it — it is simply
 * not being at a screen, which this product does not score.
 */
export const RECOVERY_CAP_MIN = 60;

/**
 * How full a stretch has to be before it counts as one continuous session.
 *
 * Bouts tolerate gaps of up to five minutes, which is right for someone who
 * gets a coffee mid-task. Applied without a floor, though, that tolerance
 * chains: half a minute of activity every three minutes from breakfast to
 * midnight joins into a single "sixteen-hour unbroken session", and every one
 * of those minutes gets classified as deep focus. That is a very ordinary
 * pattern — a tab left open and checked now and then — and it is the opposite
 * of focus, so a stretch only reads as continuous if the engaged time actually
 * fills most of the wall clock it spans.
 */
const BOUT_DENSITY_MIN = 0.6;

/** Keystrokes in a minute below which nothing is being produced. */
const PRODUCTION_KEYS = 5;

/**
 * Repair one stored minute before anything reads it.
 *
 * The store is localStorage plus a JSON import path, so a bucket can arrive
 * holding NaN, a negative count, a minute index outside the day, or a figure
 * written by an older schema. Un-repaired, a single one of those turns
 * `byHour` into a 167-element array and every downstream score into NaN, which
 * the UI then prints. Everything is coerced to a sane range here, at the one
 * place raw records are read.
 */
function sane(b: MinuteBucket): MinuteBucket | null {
  const m = Math.round(num(b?.m, -1));
  if (!(m >= 0 && m <= 1439)) return null;
  return {
    m,
    a: clamp(num(b.a), 0, 60_000),
    k: Math.max(0, Math.round(num(b.k))),
    c: Math.max(0, Math.round(num(b.c))),
    s: Math.max(0, num(b.s)),
    v: Math.max(0, num(b.v)),
    x: Math.max(0, Math.round(num(b.x))),
    b: clamp(num(b.b), 0, 100),
  };
}

/** Same repair for a hand-logged session. */
function saneExternal(e: ExternalSession): ExternalSession | null {
  const minutes = Math.round(num(e?.minutes));
  if (!(minutes > 0) || !Number.isFinite(num(e.start, NaN))) return null;
  return {
    ...e,
    minutes: Math.min(minutes, 1440),
    brightness: clamp(num(e.brightness), 0, 100),
  };
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

const emptySummary = (date: string): DaySummary => ({
  date,
  partial: false,
  activeMin: 0,
  measuredMin: 0,
  loggedMin: 0,
  keys: 0,
  clicks: 0,
  scrollPx: 0,
  scrollMeters: 0,
  burstMin: 0,
  switches: 0,
  switchRate: 0,
  byHour: Array(24).fill(0),
  minuteClass: {},
  firstEngagedMin: null,
  lastEngagedMin: null,
  sunriseMin: 0,
  curfewMin: 0,
  nightMin: 0,
  lateNightMin: 0,
  avgBrightness: 0,
  lightDose: 0,
  bouts: [],
  longestBoutMin: 0,
  deepBouts: 0,
  shortBouts: 0,
  unbrokenBouts: 0,
  breaks: [],
  breakCount: 0,
  longestBreakMin: 0,
  miles: { total: 0, focus: 0, scatter: 0, scroll: 0, recovery: 0 },
  intents: {},
});

/**
 * How much a minute contributes to light dose. Evening light is weighted more
 * heavily because that is when it actually shifts the body clock — the same
 * screen at 09:00 and at 23:30 does not do the same thing.
 */
function lateWeight(hour: number): number {
  if (hour >= 23 || hour < 5) return 2.2;
  if (hour >= 21) return 1.6;
  if (hour >= 19) return 1.2;
  return 1;
}

/**
 * Classify one engaged minute. Exactly three outcomes, so the three always sum
 * back to total mileage and no minute is counted twice.
 *
 *   SCROLL   content moved past faster than it could be read, with nothing
 *            being produced. This is the feed signature.
 *   FOCUS    the minute sits inside a stretch long enough for depth, and
 *            nothing interrupted it.
 *   SCATTER  everything else — real time, spent shallowly or in pieces.
 *
 * Note what this does NOT do: it makes no judgement about which app or site the
 * minute belonged to, because the product never looks at that. A minute spent
 * reading a long article inside a 40-minute stretch is focus; a minute of
 * flicking a feed is scroll, in any app, including this one.
 */
function classifyMinute(
  keys: number,
  velocity: number,
  switches: number,
  boutLengthMin: number,
  continuous: boolean,
): MinuteClass {
  if (velocity >= BURST_VELOCITY && keys < PRODUCTION_KEYS) return 'scroll';
  if (continuous && boutLengthMin >= DEEP_BOUT_MIN && switches === 0) return 'focus';
  return 'scatter';
}

/** Logged sessions cannot be classified per minute, so the whole session takes one class. */
function classifyExternal(ext: ExternalSession): MinuteClass {
  const productive: Category[] = ['work', 'study', 'creativity', 'reading', 'communication'];
  if (ext.intensity === 'passive' && !productive.includes(ext.category)) return 'scroll';
  if (ext.minutes >= DEEP_BOUT_MIN && ext.intensity !== 'passive' && productive.includes(ext.category)) {
    return 'focus';
  }
  return 'scatter';
}

export function summarizeDay(
  day: DayRecord | undefined,
  date: string,
  profile: Profile = DEFAULT_PROFILE,
  now = new Date(),
): DaySummary {
  const out = emptySummary(date);
  out.partial = date === toLocalKey(now);
  if (!day) return out;

  out.switches = Math.max(0, Math.round(num(day.switches)));
  out.intents = day.intents ?? {};

  const curfewStart = profile.curfewHour * 60;
  const sunriseStart = profile.wakeHour * 60;
  const sunriseEnd = sunriseStart + 60;

  // ── pass one: measured minutes ────────────────────────────────
  const engagedMinutes: number[] = [];
  let brightnessWeighted = 0;

  const buckets: MinuteBucket[] = [];
  for (const raw of Object.values(day.buckets ?? {})) {
    const b = sane(raw);
    if (b) buckets.push(b);
  }
  const byMinute = new Map(buckets.map((b) => [b.m, b]));

  for (const bucket of buckets) {
    if (bucket.a <= 0) continue;

    const hour = Math.floor(bucket.m / 60);
    const minutes = bucket.a / 60_000;

    out.measuredMin += minutes;
    out.byHour[hour] += minutes;
    out.keys += bucket.k;
    out.clicks += bucket.c;
    out.scrollPx += bucket.s;
    if (bucket.v >= BURST_VELOCITY) out.burstMin += 1;

    if (hour >= 21 || hour < 5) out.nightMin += minutes;
    if (hour >= 23 || hour < 5) out.lateNightMin += minutes;
    if (bucket.m >= curfewStart || hour < 5) out.curfewMin += minutes;
    if (bucket.m >= sunriseStart && bucket.m < sunriseEnd) out.sunriseMin += minutes;

    brightnessWeighted += bucket.b * minutes;
    out.lightDose += minutes * (bucket.b / 100) * lateWeight(hour);

    if (bucket.a >= ENGAGED_MS) engagedMinutes.push(bucket.m);
  }

  // ── pass two: bouts, from contiguous engaged minutes ──────────
  engagedMinutes.sort((a, b) => a - b);

  const runs: [number, number][] = [];
  let runStart: number | null = null;
  let prev: number | null = null;

  for (const m of engagedMinutes) {
    if (runStart === null) {
      runStart = m;
    } else if (prev !== null && m - prev > BOUT_GAP_MIN) {
      runs.push([runStart, prev]);
      runStart = m;
    }
    prev = m;
  }
  if (runStart !== null && prev !== null) runs.push([runStart, prev]);

  for (const [start, end] of runs) {
    const lengthMin = end - start + 1;
    const bout: Bout = {
      startMin: start,
      endMin: end,
      spanMin: lengthMin,
      continuous: true,
      activeMin: 0,
      keys: 0,
      clicks: 0,
      scrollPx: 0,
      switches: 0,
      source: 'measured',
      kind: 'scatter',
    };

    const tally: Record<MinuteClass, number> = { focus: 0, scatter: 0, scroll: 0 };

    for (let m = start; m <= end; m++) {
      const b = byMinute.get(m);
      if (!b || b.a <= 0) continue;
      bout.activeMin += b.a / 60_000;
      bout.keys += b.k;
      bout.clicks += b.c;
      bout.scrollPx += b.s;
      bout.switches += b.x;
    }

    /*
     * A bout's LENGTH is the time actually spent in it, not the wall clock it
     * covers. The two are the same for a real session and wildly different for
     * a tab that gets glanced at all day, and it is the second case that used
     * to be reported back as sixteen hours of deep focus.
     */
    bout.continuous = bout.activeMin >= lengthMin * BOUT_DENSITY_MIN;
    const continuous = bout.continuous;
    const effectiveMin = Math.round(bout.activeMin);

    for (let m = start; m <= end; m++) {
      const b = byMinute.get(m);
      if (!b || b.a < ENGAGED_MS) continue;
      const cls = classifyMinute(b.k, b.v, b.x, effectiveMin, continuous);
      out.minuteClass[m] = cls;
      tally[cls] += 1;
    }

    // The bout takes the class most of its minutes had — used for the timeline,
    // never for mileage, which is always summed per minute.
    bout.kind = (Object.keys(tally) as MinuteClass[]).reduce((best, k) =>
      tally[k] > tally[best] ? k : best,
    'scatter');

    out.bouts.push(bout);
  }

  // ── pass three: logged external sessions ──────────────────────
  for (const rawExt of day.externals ?? []) {
    const ext = saneExternal(rawExt);
    if (!ext) continue;
    const start = new Date(ext.start);
    const startMin = start.getHours() * 60 + start.getMinutes();
    const cls = classifyExternal(ext);
    out.loggedMin += ext.minutes;

    for (let i = 0; i < ext.minutes; i++) {
      const m = (startMin + i) % 1440;
      const hour = Math.floor(m / 60);
      out.byHour[hour] += 1;
      if (hour >= 21 || hour < 5) out.nightMin += 1;
      if (hour >= 23 || hour < 5) out.lateNightMin += 1;
      if (m >= curfewStart || hour < 5) out.curfewMin += 1;
      if (m >= sunriseStart && m < sunriseEnd) out.sunriseMin += 1;
      brightnessWeighted += ext.brightness;
      out.lightDose += (ext.brightness / 100) * lateWeight(hour);
      // Logged minutes only fill classes the measured pass left empty, so a
      // hand-logged phone session cannot overwrite something actually observed.
      if (out.minuteClass[m] === undefined) out.minuteClass[m] = cls;
    }

    // A session logged as running past midnight still belongs to the day it was
    // logged against, but its bout must stay inside the 0–1439 minute grid or
    // every timeline that positions it draws past the end of the chart.
    out.bouts.push({
      startMin,
      endMin: Math.min(1439, startMin + ext.minutes - 1),
      spanMin: Math.min(1440 - startMin, ext.minutes),
      // A logged session is a single stated stretch, so it is continuous by
      // construction — there is no minute-level detail to say otherwise.
      continuous: true,
      activeMin: ext.minutes,
      keys: 0,
      clicks: 0,
      scrollPx: 0,
      switches: 0,
      source: 'logged',
      kind: cls,
      label: ext.label,
      category: ext.category,
    });
  }

  out.bouts.sort((a, b) => a.startMin - b.startMin);

  // ── totals ────────────────────────────────────────────────────
  out.activeMin = out.measuredMin + out.loggedMin;
  out.avgBrightness = out.activeMin > 0 ? brightnessWeighted / out.activeMin : 0;
  out.scrollMeters = pxToMeters(out.scrollPx);

  // Every one of these is a claim about how long the user was actually at the
  // screen, so all of them count engaged minutes rather than wall clock.
  const boutLen = (b: Bout) => Math.round(b.activeMin);
  out.longestBoutMin = out.bouts.reduce((max, b) => Math.max(max, boutLen(b)), 0);
  out.deepBouts = out.bouts.filter((b) => b.continuous && boutLen(b) >= DEEP_BOUT_MIN).length;
  out.shortBouts = out.bouts.filter((b) => boutLen(b) < SHORT_BOUT_MIN).length;
  out.unbrokenBouts = out.bouts.filter((b) => b.continuous && boutLen(b) >= UNBROKEN_BOUT_MIN).length;

  if (out.bouts.length > 0) {
    out.firstEngagedMin = out.bouts[0].startMin;
    out.lastEngagedMin = out.bouts[out.bouts.length - 1].endMin;
  }

  // ── recovery windows: the gaps between bouts inside the active day ──
  // Only gaps *between* bouts count. Time before the first session and after
  // the last is not recovery earned during the day, and counting it would
  // reward starting late rather than taking breaks.
  //
  // The gaps are taken from the MERGED span of all bouts, not from consecutive
  // pairs. Measured bouts and hand-logged sessions overlap freely — a phone
  // session logged inside a long stretch at the laptop is the normal case — and
  // walking the sorted list pairwise reads the far side of an overlap as an
  // empty gap. An eight-hour "break" in the middle of eight hours of screen
  // time is not a rounding error, it is the opposite of what happened.
  const spans = out.bouts
    .map((b) => [b.startMin, Math.max(b.startMin, b.endMin)] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [from, to] of spans) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1] + 1) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }

  for (let i = 1; i < merged.length; i++) {
    const gapStart = merged[i - 1][1] + 1;
    const gapEnd = merged[i][0] - 1;
    const minutes = gapEnd - gapStart + 1;
    if (minutes >= RECOVERY_MIN) {
      out.breaks.push({ startMin: gapStart, endMin: gapEnd, minutes });
    }
  }
  out.breakCount = out.breaks.length;
  out.longestBreakMin = out.breaks.reduce((max, b) => Math.max(max, b.minutes), 0);

  // ── mileage ───────────────────────────────────────────────────
  let focusMin = 0;
  let scatterMin = 0;
  let scrollMin = 0;
  for (const cls of Object.values(out.minuteClass)) {
    if (cls === 'focus') focusMin += 1;
    else if (cls === 'scroll') scrollMin += 1;
    else scatterMin += 1;
  }

  // Classification runs on whole minutes while engaged time is continuous, so
  // the three classes are rescaled onto the real total. Without this a day of
  // half-full minutes would report more mileage than it earned.
  const classified = focusMin + scatterMin + scrollMin;
  const scale = classified > 0 ? out.activeMin / classified : 0;

  out.miles = {
    total: toMiles(out.activeMin),
    focus: toMiles(focusMin * scale),
    scatter: toMiles(scatterMin * scale),
    scroll: toMiles(scrollMin * scale),
    recovery: toMiles(out.breaks.reduce((s, b) => s + Math.min(b.minutes, RECOVERY_CAP_MIN), 0)),
  };

  const hours = out.activeMin / 60;
  // Below about a quarter of an hour the rate is noise, not a rate.
  out.switchRate = hours >= 0.25 ? out.switches / hours : 0;

  // Round only what the UI prints; the raw figures stay intact above.
  out.measuredMin = Math.round(out.measuredMin);
  out.loggedMin = Math.round(out.loggedMin);
  out.activeMin = Math.round(out.activeMin);
  out.nightMin = Math.round(out.nightMin);
  out.lateNightMin = Math.round(out.lateNightMin);
  out.curfewMin = Math.round(out.curfewMin);
  out.sunriseMin = Math.round(out.sunriseMin);
  out.lightDose = Math.round(out.lightDose);
  out.avgBrightness = clamp(Math.round(out.avgBrightness), 0, 100);
  out.byHour = out.byHour.map((v) => Math.round(v * 10) / 10);

  return out;
}

function toLocalKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
