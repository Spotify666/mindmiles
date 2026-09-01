/**
 * MIND MILES — data model.
 *
 * Everything defined here lives in one browser, in localStorage, on one device.
 * There is no account, no sync and no server, which is the only reason a model
 * this granular is defensible: the raw record never leaves the machine that
 * produced it, so the product can afford to measure honestly instead of
 * measuring whatever is safe to upload.
 *
 * Two rules govern every field below.
 *
 *   Counts, never contents. Keystrokes are counted; the key is never read.
 *   Scroll distance is summed; what was on screen is never inspected.
 *
 *   Nothing is invented. Where a signal cannot be measured in a browser it is
 *   marked `unavailable` and shown as unavailable, rather than being modelled
 *   and presented as if it were observed.
 */

// ─────────────────────────── raw record ───────────────────────────

/**
 * One minute of the day. Keys are single characters because this is the most
 * frequently written structure in the app and it is serialised in full on
 * every flush.
 */
export interface MinuteBucket {
  /** Minute of day, 0–1439. */
  m: number;
  /** Engaged milliseconds inside this minute, 0–60000. */
  a: number;
  /** Keystroke COUNT. The key itself is never read, stored or transmitted. */
  k: number;
  /** Pointer clicks and taps. */
  c: number;
  /** Scroll distance, CSS pixels. */
  s: number;
  /** Peak scroll velocity seen this minute, CSS px/s. Drives burst detection. */
  v: number;
  /** Context switches that began in this minute. */
  x: number;
  /** Effective screen brightness at the time, 0–100. See ./brightness. */
  b: number;
}

/** Broad intent categories. Deliberately few — a taxonomy nobody maintains is worse than none. */
export const CATEGORIES = [
  'work',
  'study',
  'communication',
  'creativity',
  'reading',
  'social',
  'entertainment',
  'recovery',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  work: 'Work',
  study: 'Study',
  communication: 'Communication',
  creativity: 'Creativity',
  reading: 'Reading',
  social: 'Social',
  entertainment: 'Entertainment',
  recovery: 'Recovery',
};

/**
 * Time spent somewhere this browser cannot see — another app, another device,
 * a phone. Logged by hand. Kept separate from measured time everywhere it is
 * displayed, so the two are never silently blended.
 */
export interface ExternalSession {
  id: string;
  label: string;
  category: Category;
  /** Epoch ms. */
  start: number;
  minutes: number;
  brightness: number;
  /** Rough input intensity, used for load weighting only. */
  intensity: 'passive' | 'moderate' | 'heavy';
}

export interface DayRecord {
  /** YYYY-MM-DD, local time. */
  date: string;
  buckets: Record<string, MinuteBucket>;
  /** Context switches observed across the whole day. */
  switches: number;
  externals: ExternalSession[];
  /** What the user said they intended to spend, in minutes, before the day ran. */
  intents: Partial<Record<Category, number>>;
}

// ─────────────────────────── profile & state ───────────────────────────

export interface Profile {
  displayName: string;
  /** Used on the share card and public profile. */
  handle: string;
  /** Local hour the user considers "morning start". Anchors sunrise metrics. */
  wakeHour: number;
  /** Local hour they intend to be off screens by. Anchors sunset metrics. */
  curfewHour: number;
}

/** Everything is private until switched on, one field at a time. */
export interface SharingPrefs {
  fitness: boolean;
  miles: boolean;
  records: boolean;
  challenges: boolean;
  reclaimed: boolean;
  streak: boolean;
}

export interface ChallengeEnrollment {
  id: string;
  /** YYYY-MM-DD the challenge window opened. */
  startedOn: string;
  /** Set once the challenge has been satisfied, so it stops re-evaluating. */
  completedOn?: string;
}

export interface MindMilesState {
  version: number;
  /** The brightness the user declared, used when nothing better can be read. */
  brightness: number;
  /** Measurement is opt-in and can be switched off without losing history. */
  enabled: boolean;
  seeded: boolean;
  onboarded: boolean;
  profile: Profile;
  days: Record<string, DayRecord>;
  challenges: Record<string, ChallengeEnrollment>;
  /** Record key → the best value already shown, so a new best can be flagged once. */
  seenRecords: Record<string, number>;
  sharing: SharingPrefs;
}

// ─────────────────────────── derived shapes ───────────────────────────

/**
 * How a minute of engaged time was spent. Every engaged minute gets exactly one
 * class, so the three always sum back to total mileage.
 */
export type MinuteClass = 'focus' | 'scatter' | 'scroll';

/** A continuous stretch of engagement with no real break inside it. */
export interface Bout {
  startMin: number;
  endMin: number;
  /** Engaged minutes inside the bout — always ≤ its wall-clock span. */
  activeMin: number;
  keys: number;
  clicks: number;
  scrollPx: number;
  /** Switches that happened without ending the bout. Fragmentation inside focus. */
  switches: number;
  source: 'measured' | 'logged';
  /** The dominant class of the minutes inside it. */
  kind: MinuteClass;
  label?: string;
  category?: Category;
}

/** A gap between bouts long enough to count as genuine recovery. */
export interface RecoveryWindow {
  startMin: number;
  endMin: number;
  minutes: number;
}

/** Mileage, the product's base unit. One Mind Mile = 20 engaged minutes. */
export interface Mileage {
  total: number;
  focus: number;
  scatter: number;
  scroll: number;
  /** Recovery is measured off-screen, so it is counted alongside, not inside, total. */
  recovery: number;
}

/** A single day, aggregated and chart-ready. */
export interface DaySummary {
  date: string;
  /** True while the day is still running — partial days must not set records. */
  partial: boolean;

  activeMin: number;
  measuredMin: number;
  loggedMin: number;

  keys: number;
  clicks: number;
  scrollPx: number;
  /** Scroll distance converted to metres. Estimated — see lib/mm/format. */
  scrollMeters: number;
  /** Minutes where scroll velocity crossed the burst threshold. */
  burstMin: number;

  switches: number;
  /** Switches per engaged hour. */
  switchRate: number;

  /** Engaged minutes per hour of day, 0–23. */
  byHour: number[];
  /** Minute of day → how that minute was spent. Only engaged minutes appear. */
  minuteClass: Record<number, MinuteClass>;

  firstEngagedMin: number | null;
  lastEngagedMin: number | null;
  /** Engaged minutes in the first hour after the user's declared wake hour. */
  sunriseMin: number;
  /** Engaged minutes after the user's declared curfew hour. */
  curfewMin: number;
  /** Engaged minutes from 21:00. */
  nightMin: number;
  /** Engaged minutes from 23:00. */
  lateNightMin: number;

  avgBrightness: number;
  /** Engaged minutes weighted by brightness and lateness. A relative index, not lux. */
  lightDose: number;

  bouts: Bout[];
  longestBoutMin: number;
  /** Bouts of 25 minutes or more — the length at which deep work becomes possible. */
  deepBouts: number;
  /** Bouts under 5 minutes — the shape of compulsive checking. */
  shortBouts: number;
  /** Bouts that ran past 20 minutes with no break. */
  unbrokenBouts: number;

  breaks: RecoveryWindow[];
  breakCount: number;
  longestBreakMin: number;

  miles: Mileage;
  intents: Partial<Record<Category, number>>;
}

// ─────────────────────────── metrics ───────────────────────────

export type MetricId =
  | 'fitness'
  | 'focus'
  | 'recovery'
  | 'strain'
  | 'visual'
  | 'fragmentation'
  | 'intentionality';

/**
 * Where a number came from. Shown next to every value in the UI, because a
 * product that mixes observation with inference silently is not measuring
 * anything — it is decorating.
 */
export type Provenance = 'measured' | 'derived' | 'estimated' | 'unavailable';

export const PROVENANCE_LABEL: Record<Provenance, string> = {
  measured: 'Counted',
  derived: 'Worked out',
  estimated: 'Best guess',
  unavailable: "Can't tell",
};

export const PROVENANCE_NOTE: Record<Provenance, string> = {
  measured: 'Your device watched this happen and counted it.',
  derived: 'Plain maths on things we counted. Nothing guessed.',
  estimated: 'Worked out from clues. Good for spotting a change, not exact.',
  unavailable: "We can't measure this properly here, so we don't show a number.",
};

/** `a` is always the best band, whichever way the metric points. */
export type Band = 'optimal' | 'solid' | 'watch' | 'strained';

export interface BaselineDelta {
  /** The user's own normal for this metric and this kind of day. */
  baseline: number;
  /** value − baseline. */
  change: number;
  /** Percentage change, or null when the baseline is ~0. */
  percent: number | null;
  /** Whether this change is an improvement, given the metric's polarity. */
  better: boolean;
  /** Days of history behind the baseline. Under MIN_BASELINE_DAYS it is still building. */
  samples: number;
}

/** One line of a metric's arithmetic, shown in the explain sheet. */
export interface MetricInput {
  label: string;
  /** Already formatted for display. */
  value: string;
  /** This input's own 0–100 contribution, before weighting. */
  score?: number;
  /** Its share of the final score, 0–1. */
  weight?: number;
  provenance: Provenance;
  /** Why this input belongs in the metric at all. */
  detail: string;
}

export interface Metric {
  id: MetricId;
  label: string;
  /**
   * The metric in words a stranger would use. Shown directly under the name
   * everywhere the metric appears, so nobody has to already know what
   * "fragmentation" means to read their own screen.
   */
  plain: string;
  /**
   * One concrete measurement, in real units, that this score is mostly about.
   * "2h 12m best run". "3 breaks". "32 jumps an hour".
   *
   * This exists because six scores out of 100 look identical however well they
   * are named — number, word, bar, number, word, bar. A reader cannot tell them
   * apart, and reasonably concludes the definitions are all the same thing.
   * A minutes-and-counts figure that only makes sense for THIS metric is what
   * makes it obviously a different measurement from the one beside it, and it
   * is also the part someone can actually act on.
   */
  fact: string;
  /** 0–100. */
  value: number;
  polarity: 'higher-better' | 'lower-better';
  band: Band;
  provenance: Provenance;
  /** The band, in this metric's own words. */
  bandLabel: string;
  /** One sentence the user reads before anything else. */
  headline: string;
  inputs: MetricInput[];
  delta?: BaselineDelta;
}

export interface DayReport {
  date: string;
  summary: DaySummary;
  fitness: Metric;
  focus: Metric;
  recovery: Metric;
  strain: Metric;
  visual: Metric;
  fragmentation: Metric;
  intentionality: Metric;
  /** Indexed for lookup by the explain sheet and share card. */
  byId: Record<MetricId, Metric>;
}

// ─────────────────────────── achievement ───────────────────────────

export interface PersonalRecord {
  key: string;
  label: string;
  /** Formatted for display. */
  display: string;
  value: number;
  date: string;
  /** The value this beat, when there was one. */
  previous?: number;
  previousDisplay?: string;
  previousDate?: string;
  /** Set on the day it was first achieved and not yet acknowledged. */
  isNew: boolean;
  blurb: string;
}

export type ChallengeStatus = 'available' | 'active' | 'complete' | 'expired';

export interface ChallengeDef {
  id: string;
  name: string;
  /** The promise, in one line. */
  premise: string;
  /** Exactly what has to happen, stated as a testable condition. */
  criterion: string;
  /** Window length in days. */
  days: number;
  accent: 'focus' | 'recovery' | 'strain' | 'scatter' | 'record';
}

export interface ChallengeProgress {
  def: ChallengeDef;
  status: ChallengeStatus;
  /** 0–1. */
  progress: number;
  /** Progress in the challenge's own terms, e.g. "3 of 5 sessions". */
  detail: string;
  daysLeft?: number;
  startedOn?: string;
  completedOn?: string;
}

/** Time won back against the user's own baseline — the product's headline number. */
export interface Reclaimed {
  /** Total minutes reclaimed across the window. */
  minutes: number;
  days: number;
  breakdown: { label: string; minutes: number; detail: string }[];
  /** False until the baseline has enough history to compare against. */
  available: boolean;
}

export interface Insight {
  id: string;
  /** Ranked; the Today screen shows one, the coach shows the rest. */
  priority: number;
  tone: 'win' | 'watch' | 'steady';
  title: string;
  /** The measurement that triggered it. */
  evidence: string;
  /** What to do differently, specifically. */
  action: string;
  /** Why that action follows from that evidence. */
  because: string;
  accent: 'focus' | 'recovery' | 'strain' | 'scatter' | 'record';
}
