import { clsx, type ClassValue } from 'clsx';

/** Tailwind-friendly class combiner. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Coerce anything to a finite number.
 *
 * Every formatter runs its input through this. Not because the arithmetic
 * upstream is expected to produce NaN, but because the store is localStorage —
 * a text file the user can edit, an export they can re-import, a value written
 * by an older version of the app. One bad figure in there should show as a dash
 * on one card, never as the literal text "NaN" in a headline.
 */
export function finite(n: number, fallback = 0): number {
  return Number.isFinite(n) ? n : fallback;
}

/**
 * MINUTES PER MILE — the base unit of the whole product.
 *
 * One mile is twenty engaged minutes. Twenty is not decorative: it is the
 * interval in the 20-20-20 break guideline, and it is roughly the shortest
 * stretch in which attention research finds people reaching any depth. It also
 * lands a normal day between about 5 and 25 miles, which is a range a person
 * can hold in their head. The constant is stated in the UI wherever a mile
 * appears, so the number is convertible back to minutes by anyone who wants to.
 */
export const MIN_PER_MILE = 20;

export function toMiles(minutes: number): number {
  return finite(minutes) / MIN_PER_MILE;
}

export function fmtMiles(miles: number): string {
  const v = finite(miles);
  if (v >= 100) return v.toFixed(0);
  return v.toFixed(1);
}

/**
 * CSS pixels to metres.
 *
 * A CSS pixel is defined as 1/96 inch, so this conversion is exact against the
 * spec — but the spec's inch is a reference angle, not the glass in your hand,
 * and device pixel ratios move the real figure around. So the number is honest
 * arithmetic on a nominal unit, and it is labelled ESTIMATED everywhere it is
 * displayed. It is never inflated into kilometres to sound impressive.
 */
export const METERS_PER_CSS_PX = 0.0254 / 96;

export function pxToMeters(px: number): number {
  return finite(px) * METERS_PER_CSS_PX;
}

export function fmtDistance(meters: number): string {
  const v = Math.max(0, finite(meters));
  if (v >= 1000) return `${(v / 1000).toFixed(2)} km`;
  if (v >= 10) return `${Math.round(v)} m`;
  return `${v.toFixed(1)} m`;
}

/**
 * "2h 14m", "48m", "under a minute". Never "2.23 hours", and never "0m" for
 * time that did happen — a site you were on for ten seconds reading "0m" looks
 * like a bug, because it looks like nothing was counted.
 */
export function fmtMin(minutes: number): string {
  const raw = Math.max(0, finite(minutes));
  if (raw > 0 && raw < 1) return 'under a minute';
  const m = Math.round(raw);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/** Compact clock for live readouts: "12:04" or "1:02:17". */
export function fmtClock(totalSec: number): string {
  const t = Math.max(0, finite(totalSec));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Minute of day to "09:10". */
export function fmtTimeOfDay(minuteOfDay: number): string {
  const m = ((Math.round(finite(minuteOfDay)) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function fmtRange(startMin: number, endMin: number): string {
  return `${fmtTimeOfDay(startMin)}–${fmtTimeOfDay(endMin)}`;
}

/** Signed percentage, already rounded: "+27%", "−18%", "—". */
export function fmtPercent(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return '—';
  const v = Math.round(p);
  if (v === 0) return 'level';
  return `${v > 0 ? '+' : '−'}${Math.abs(v)}%`;
}

export function fmtSigned(n: number): string {
  const v = Math.round(finite(n));
  if (v === 0) return '0';
  return `${v > 0 ? '+' : '−'}${Math.abs(v)}`;
}

export function fmtCount(n: number): string {
  return Math.round(finite(n)).toLocaleString();
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Noon local on a stored day key, or null if the key is not a real date. */
function atNoon(iso: string): Date | null {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Tue 24 Jun". Dates in this app are always local and always ISO in storage. */
export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = atNoon(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...opts });
}

export function weekdayShort(iso: string): string {
  const d = atNoon(iso);
  return d ? d.toLocaleDateString(undefined, { weekday: 'short' }) : '—';
}

export function isWeekend(iso: string): boolean {
  const d = atNoon(iso);
  if (!d) return false;
  const wd = d.getDay();
  return wd === 0 || wd === 6;
}

/**
 * Scale a raw value into a 0–100 load figure.
 *
 * Below `comfortable` the curve stays inside the bottom quarter, so ordinary
 * days do not read as alarming. Above it, the remaining 75 points are spent
 * linearly up to `severe`. Both thresholds are shown in the explain sheet for
 * every metric that uses this, which is the point of having one shared ramp
 * rather than a bespoke curve per metric.
 */
export function ramp(value: number, comfortable: number, severe: number): number {
  const v = finite(value);
  if (v <= 0) return 0;
  if (v <= comfortable) return (v / Math.max(comfortable, 1)) * 25;
  const t = (v - comfortable) / Math.max(severe - comfortable, 1);
  return clamp(25 + t * 75, 0, 100);
}

/** `ramp` inverted, for inputs where more is better. */
export function rampInverse(value: number, target: number, floor = 0): number {
  const v = finite(value);
  if (v >= target) return 100;
  const t = (v - floor) / Math.max(target - floor, 1);
  return clamp(t * 100, 0, 100);
}

/** Median. Used for baselines because one 14-hour travel day should not move a normal. */
export function median(values: number[]): number {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return 0;
  const s = clean.sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mean(values: number[]): number {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length === 0) return 0;
  return clean.reduce((s, n) => s + n, 0) / clean.length;
}
