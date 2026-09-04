import type { Config } from 'tailwindcss';

/**
 * PHOTON design system.
 *
 * A drawn interface, not a rendered one. The reference is a printed zine or a
 * page from a notebook: paper, hard ink outlines, hand-drawn underlines, and
 * strips of tape holding things down. Everything that would normally be done
 * with a soft shadow is done with a line instead.
 *
 * Three rules carry the whole look:
 *
 *   OUTLINES, NEVER SHADOWS. Every card is a 2px ink border on white. There is
 *   no elevation model, no blur, no glow. Depth comes from overlap and tape.
 *
 *   ONE ACCENT, USED LOUDLY. Sky blue does the work amber does on the
 *   reference — button fills, underlines, tape, bullets, illustration. Not a
 *   tint applied everywhere, but a handful of confident marks.
 *
 *   PAPER IS NOT WHITE. The canvas is a cool off-white with a faint tint, and
 *   cards are true white on top of it. That half-step is what stops a light
 *   interface reading as a blank browser page.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The page itself — cool paper, never pure white.
        paper: {
          DEFAULT: '#EFF4F9',
          deep: '#E4EDF5',
        },
        card: '#FFFFFF',
        // Ink. One near-black, stepped by role. Every step clears 4.5:1 on
        // paper, including `faint` — a label grey nobody can read is not a
        // subtle label, it is a missing one.
        ink: {
          DEFAULT: '#14181F',
          soft: '#4B5563',
          faint: '#646D7B',
        },
        // Sky — the single accent. `DEFAULT` is for fills and large type;
        // `deep` is the text-safe step, and small coloured text must use it.
        sky: {
          DEFAULT: '#2B90E0',
          deep: '#1B6FB8',
          soft: '#BFDFF6',
          wash: '#E8F3FC',
        },
        /*
         * Data hues, in two tiers.
         *
         * DEFAULT is the validated chart mark — this exact set passes lightness
         * band, chroma floor, all-pairs colour-deficiency separation (worst
         * deutan ΔE 8.6, above the floor entirely) and 3:1 contrast against a
         * white plot surface.
         *
         * `text` is the darkened step for small coloured type, because a mark
         * that is legible as a 20px bar is not legible as 12px text. Chart
         * fills use DEFAULT; any coloured word or delta uses `text`.
         */
        focus: { DEFAULT: '#1A41BE', text: '#1A41BE', wash: '#E7ECFA' },
        rest: { DEFAULT: '#09A668', text: '#057A4D', wash: '#E0F5EC' },
        effort: { DEFAULT: '#C97405', text: '#9A5A04', wash: '#FCEEDC' },
        jumpy: { DEFAULT: '#86008F', text: '#86008F', wash: '#F7E6F8' },
        gold: { DEFAULT: '#B07A0E', text: '#8F630B', wash: '#FAF1DC' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        hand: ['var(--font-hand)', 'var(--font-sans)', 'cursive'],
      },
      letterSpacing: {
        tightest: '-0.035em',
        label: '0.04em',
      },
      borderRadius: {
        card: '14px',
        pill: '999px',
      },
      borderWidth: {
        3: '3px',
      },
      maxWidth: {
        app: '480px',
        wide: '1120px',
      },
      boxShadow: {
        // The only "shadow" in the system is a hard offset — a second outline,
        // not a blur. Used sparingly, on the primary button and on tiles that
        // should feel physically stacked.
        stack: '3px 3px 0 0 #14181F',
        'stack-sm': '2px 2px 0 0 #14181F',
      },
      keyframes: {
        'draw-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'tape-settle': {
          from: { opacity: '0', transform: 'rotate(-8deg) scale(0.9)' },
          to: { opacity: '1', transform: 'rotate(-4deg) scale(1)' },
        },
      },
      animation: {
        'draw-in': 'draw-in 480ms cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
