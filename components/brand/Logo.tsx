/**
 * PHOTON — the mark.
 *
 * In a Feynman diagram a photon is drawn as a wavy line. That is not a
 * decorative choice by physicists; it is the standard notation for a particle
 * of light travelling. So the mark is exactly that: a loose wave, drawn in one
 * stroke, ending in the particle itself.
 *
 * It earns its place twice over. It is the literal notation for the thing the
 * product is named after — light arriving from a screen — and it is the same
 * gesture as the hand-drawn underline used throughout the interface. The
 * underline under a heading and the logo in the corner are the same drawn
 * stroke, which is what makes the whole thing feel like one hand.
 *
 * Drawn once in a 44×24 field and reused everywhere, so the wave is identical
 * from a 16px favicon to a share card.
 */

/** Three crests, then the particle. Every coordinate lives here and nowhere else. */
export const WAVE_PATH =
  'M3,12 C6,4 10,4 13,12 C16,20 20,20 23,12 C26,4 30,4 33,12';
export const PARTICLE = { x: 38.5, y: 12, r: 3.1 } as const;
const VIEW = '0 0 44 24';

export type MarkTone = 'sky' | 'ink' | 'current';

const STROKE: Record<MarkTone, string> = {
  sky: '#2B90E0',
  ink: '#14181F',
  current: 'currentColor',
};

export function Mark({
  size = 30,
  tone = 'sky',
  className,
  title,
}: {
  /** Height in px. Width follows the mark's own 44:24 proportion. */
  size?: number;
  tone?: MarkTone;
  className?: string;
  /** Set only when the mark is the sole label for a control. */
  title?: string;
}) {
  const colour = STROKE[tone];
  return (
    <svg
      height={size}
      width={(size * 44) / 24}
      viewBox={VIEW}
      fill="none"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path
        d={WAVE_PATH}
        stroke={colour}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={PARTICLE.x} cy={PARTICLE.y} r={PARTICLE.r} fill={colour} />
    </svg>
  );
}

/**
 * Mark plus wordmark.
 *
 * Set lowercase. A product that speaks plainly and draws its own underlines
 * should not shout its own name in capitals — the lowercase setting is doing
 * the same job as the rest of the tone.
 */
export function Wordmark({
  size = 'md',
  tone = 'sky',
  tagline = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  tone?: MarkTone;
  tagline?: boolean;
  className?: string;
}) {
  const scale = {
    sm: { mark: 17, text: 'text-[19px]', gap: 'gap-2' },
    md: { mark: 22, text: 'text-[25px]', gap: 'gap-2.5' },
    lg: { mark: 32, text: 'text-[38px]', gap: 'gap-3' },
  }[size];

  return (
    <span className={className}>
      <span className={`flex items-center ${scale.gap}`}>
        <Mark size={scale.mark} tone={tone} />
        <span className={`${scale.text} font-extrabold lowercase leading-none tracking-tightest text-ink`}>
          photon
        </span>
      </span>
      {tagline && (
        <span className="mt-2.5 block text-[14px] text-ink-soft">
          See what your screens are really doing.
        </span>
      )}
    </span>
  );
}

export default Mark;
