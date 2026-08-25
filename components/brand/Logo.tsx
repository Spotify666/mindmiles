/**
 * MIND MILES — the mark.
 *
 * The mark is a route profile. Five points, one continuous stroke, drawn the
 * way a GPS trace is drawn: round caps, round joins, no fill.
 *
 * Three things are encoded in the geometry, and they are the whole idea of the
 * product:
 *
 *   1. It reads as an M. Two peaks, two legs — the letterform is the route,
 *      not a monogram sitting next to one.
 *   2. The second peak is higher than the first. The line improves as it goes.
 *   3. It ends above where it started — END_Y is 11.5 units above START_Y on a
 *      40-unit field. The distance covered is not the achievement; the altitude
 *      gained is. That is the difference between screen time and Mind Miles.
 *
 * A single filled node sits at the terminus: the mile marker, where you are now.
 *
 * Everything is expressed in one 40×40 coordinate space so the mark is
 * identical from a 16px favicon to a share card, and the default variant paints
 * in `currentColor` so it inherits whatever it is placed on.
 */

/** The route, in the 40×40 field. Peaks ascend; the terminus clears the start. */
const ROUTE = [
  [4, 30.5], // start — low left
  [11.5, 13], // first peak
  [18.5, 21.5], // the dip between them
  [26.5, 6.5], // second peak, higher than the first
  [33, 19], // terminus — 11.5 above the start
] as const;

const PATH = ROUTE.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
const [NODE_X, NODE_Y] = ROUTE[ROUTE.length - 1];

/**
 * The route does not fill its 40-unit field — it occupies x 2–37.9 and y 4.5–32.5
 * once the stroke width and the node are accounted for. So the viewBox is the
 * ink's own square rather than the nominal field, which is what stops the mark
 * sitting high and left of centre when it is set beside text.
 */
const VIEW_BOX = '1.45 0 37 37';

export type MarkVariant = 'mono' | 'gradient';

export function Mark({
  size = 28,
  variant = 'mono',
  className,
  title,
}: {
  size?: number;
  variant?: MarkVariant;
  className?: string;
  /** Set only when the mark is the sole label for a control. */
  title?: string;
}) {
  // Unique per instance so two marks on one page cannot fight over one gradient id.
  const id = `mm-${variant}-${size}`;
  const stroke = variant === 'gradient' ? `url(#${id})` : 'currentColor';

  return (
    <svg
      width={size}
      height={size}
      viewBox={VIEW_BOX}
      fill="none"
      className={className}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {variant === 'gradient' && (
        <defs>
          {/* Attention entering blue, leaving as an achievement. The hues are
              the product's own focus → record semantics, not decoration. */}
          <linearGradient id={id} x1="4" y1="30.5" x2="33" y2="19" gradientUnits="userSpaceOnUse">
            <stop stopColor="#497CFD" />
            <stop offset="0.62" stopColor="#7C9BFF" />
            <stop offset="1" stopColor="#F5C451" />
          </linearGradient>
        </defs>
      )}

      <path
        d={PATH}
        stroke={stroke}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* The mile marker. Punched out of the stroke by a ring in the canvas
          colour so it stays a distinct object at 16px instead of a blob. */}
      <circle cx={NODE_X} cy={NODE_Y} r={4.9} fill="#08090C" />
      <circle cx={NODE_X} cy={NODE_Y} r={3.3} fill={variant === 'gradient' ? '#F5C451' : 'currentColor'} />
    </svg>
  );
}

/**
 * Mark plus wordmark. The two words are set as one unit at a single weight —
 * splitting them across weights or colours is the thing that makes a wordmark
 * look like a logo generator made it.
 */
export function Wordmark({
  size = 'md',
  variant = 'mono',
  tagline = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  variant?: MarkVariant;
  tagline?: boolean;
  className?: string;
}) {
  const scale = {
    sm: { mark: 22, text: 'text-[15px]', gap: 'gap-2' },
    md: { mark: 30, text: 'text-[20px]', gap: 'gap-2.5' },
    lg: { mark: 46, text: 'text-[31px]', gap: 'gap-3.5' },
  }[size];

  return (
    <span className={className}>
      <span className={`flex items-center ${scale.gap}`}>
        <Mark size={scale.mark} variant={variant} />
        <span
          className={`${scale.text} font-[620] uppercase leading-none tracking-[-0.03em]`}
        >
          Mind&nbsp;Miles
        </span>
      </span>
      {tagline && (
        <span className="label mt-2.5 block text-chalk-45">Measure where your attention goes</span>
      )}
    </span>
  );
}

export default Mark;
