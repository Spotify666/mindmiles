import type { Band, MetricId } from '@/lib/mm/types';

/**
 * Colour, on paper.
 *
 * The palette was refitted from scratch when the interface moved from a
 * near-black instrument panel to a light, drawn page — a set validated against
 * a #08090C surface is simply wrong against white, and reusing it would have
 * been the easy mistake.
 *
 * THE MARKS ARE VALIDATED, NOT CHOSEN BY EYE. Against a white plot surface the
 * four categorical hues below pass, on all pairs rather than only adjacent ones:
 *
 *   lightness band     all four inside OKLCH L 0.43–0.77
 *   chroma floor       all four at or above C 0.10
 *   colour deficiency  worst pair ΔE 8.6 (deutan) — clear of the 6–8 floor,
 *                      so colour is not carrying identity on its own
 *   normal vision      worst pair ΔE 20.3
 *   contrast           all four at least 3:1 against white
 *
 * TWO TIERS. A hue legible as a 20px bar is not legible as 12px text: at mark
 * strength, amber manages 3.5:1 and green 3.2:1 on white — fine for a fill,
 * below AA for a word. So every hue has a darkened `TEXT_HEX` step for coloured
 * type, and the rule is simple: fills use the mark, words use the text step.
 */

export type Accent = 'focus' | 'rest' | 'effort' | 'jumpy' | 'gold' | 'neutral';

/** Chart marks and large numerals. */
export const ACCENT_HEX: Record<Accent, string> = {
  focus: '#1A41BE',
  rest: '#09A668',
  effort: '#C97405',
  jumpy: '#86008F',
  /** Reserved for achievement. Never a data series, always with a word beside it. */
  gold: '#B07A0E',
  /** Structural only: tracks, empty states. Never a series. */
  neutral: '#B4BDC9',
};

/** The same hues, darkened to clear 4.5:1 for small coloured text. */
export const TEXT_HEX: Record<Accent, string> = {
  focus: '#1A41BE',
  rest: '#057A4D',
  effort: '#9A5A04',
  jumpy: '#86008F',
  gold: '#8F630B',
  neutral: '#646D7B',
};

/** Pale fills for badges and highlight blocks. */
export const WASH_HEX: Record<Accent, string> = {
  focus: '#E7ECFA',
  rest: '#E0F5EC',
  effort: '#FCEEDC',
  jumpy: '#F7E6F8',
  gold: '#FAF1DC',
  neutral: '#EEF2F7',
};

export const METRIC_ACCENT: Record<MetricId, Accent> = {
  fitness: 'gold',
  focus: 'focus',
  recovery: 'rest',
  strain: 'effort',
  visual: 'effort',
  fragmentation: 'jumpy',
  intentionality: 'focus',
};

/**
 * The three ways a minute gets spent. These are the only categorical series in
 * the app and they always appear together, so they take the most separated hues.
 */
export const CLASS_ACCENT = {
  focus: 'focus',
  scatter: 'jumpy',
  scroll: 'effort',
} as const;

export const CLASS_LABEL = {
  focus: 'Focused',
  scatter: 'Bits and pieces',
  scroll: 'Scrolling',
} as const;

export const CLASS_NOTE = {
  focus: 'Inside a long, unbroken block.',
  scatter: 'Real time, but spent in fragments.',
  scroll: 'Moving past faster than you could read.',
} as const;

export const CLASS_ORDER = ['focus', 'scatter', 'scroll'] as const;

/** Bands shift opacity, not hue. This interface has no red warning states. */
export const BAND_OPACITY: Record<Band, number> = {
  optimal: 1,
  solid: 0.9,
  watch: 0.8,
  strained: 0.7,
};

/** Chart furniture, on paper. */
export const GRID = 'rgba(20,24,31,0.13)';
export const AXIS_TEXT = '#646D7B';
export const INK = '#14181F';
/** Plot surface — segment gaps are painted in this. */
export const SURFACE = '#FFFFFF';

export function accentHex(a: Accent): string {
  return ACCENT_HEX[a];
}

export function textHex(a: Accent): string {
  return TEXT_HEX[a];
}
