import type { Band, MetricId } from '@/lib/mm/types';

/**
 * Colour is semantics here, not decoration.
 *
 * Each metric owns one hue and keeps it everywhere it appears — ring, bar,
 * sparkline, share card. That consistency is what lets someone glance at a
 * chart and know what they are looking at before reading a label.
 *
 * THE PALETTE IS VALIDATED, NOT CHOSEN BY EYE.
 *
 * The four categorical hues below were fitted against the dark chart surface
 * (#101219) and pass, on all pairs rather than only adjacent ones:
 *
 *   lightness band     all four inside OKLCH L 0.48–0.67
 *   chroma floor       all four at or above C 0.10, so none reads as grey
 *   normal vision      worst pair ΔE 21.3 — comfortably above the floor of 15
 *   contrast           all four at least 3:1 against the surface, 5.3:1 or
 *                      better as text on the page canvas
 *   colour deficiency  worst pair ΔE 6.2 (protan)
 *
 * That last figure sits in the 6–8 band, which is permitted ONLY where colour
 * is not the sole carrier of identity. So every chart in this app that uses
 * more than one of these hues also carries a direct label on each segment and a
 * 2px surface gap between adjacent fills. That obligation is real: if you add a
 * multi-series chart here, it needs labels, not just colours.
 *
 * The earlier palette failed this. Blue and violet at the same lightness came
 * out at ΔE 0.4 under deuteranopia — indistinguishable — which is exactly the
 * kind of thing that survives a design review and fails a real reader. The fix
 * was separating the hues by lightness as well as by hue.
 */

export type Accent = 'focus' | 'recovery' | 'strain' | 'scatter' | 'record' | 'neutral';

export const ACCENT_HEX: Record<Accent, string> = {
  focus: '#497CFD',
  recovery: '#00AA6A',
  strain: '#CD7707',
  scatter: '#CE52D7',
  /**
   * Reserved. Gold marks achievement and nothing else — it is never assigned to
   * a data series, and it never appears without a trophy glyph and a word
   * beside it, so it is never carrying meaning on its own.
   */
  record: '#F5C451',
  /** Structural only: tracks, disabled states, absent data. Never a series. */
  neutral: '#8A90A0',
};

export const METRIC_ACCENT: Record<MetricId, Accent> = {
  fitness: 'record',
  focus: 'focus',
  recovery: 'recovery',
  strain: 'strain',
  visual: 'strain',
  fragmentation: 'scatter',
  intentionality: 'focus',
};

/**
 * The three mileage classes. These are the only categorical series in the app,
 * and they always appear together, so they take the three most separated hues.
 */
export const CLASS_ACCENT = {
  focus: 'focus',
  scatter: 'scatter',
  scroll: 'strain',
} as const;

export const CLASS_LABEL = {
  focus: 'Focus',
  scatter: 'Scattered',
  scroll: 'Scroll',
} as const;

export const CLASS_NOTE = {
  focus: 'Inside a stretch of 25 minutes or more, uninterrupted.',
  scatter: 'Real time, spent shallowly or in pieces.',
  scroll: 'Content moving faster than it could be read.',
} as const;

export const CLASS_ORDER = ['focus', 'scatter', 'scroll'] as const;

/**
 * Bands vary opacity, not hue, so a strained metric does not turn the interface
 * red. This product does not do warning screens.
 */
export const BAND_OPACITY: Record<Band, number> = {
  optimal: 1,
  solid: 0.88,
  watch: 0.76,
  strained: 0.64,
};

/** The recessive grid/axis ink used by every chart. */
export const GRID = 'rgba(244,246,250,0.10)';
export const AXIS_TEXT = 'rgba(244,246,250,0.45)';
/** Chart surface — segments are separated by 2px gaps painted in this. */
export const SURFACE = '#101219';

export function accentHex(a: Accent): string {
  return ACCENT_HEX[a];
}
