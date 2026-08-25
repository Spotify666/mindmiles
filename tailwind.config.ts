import type { Config } from 'tailwindcss';

/**
 * MIND MILES design system.
 *
 * The reference points are WHOOP, Oura, Strava's activity detail and Linear —
 * an instrument, not a wellness app. That means: a deep near-black canvas so
 * data is the only thing emitting light, one weight of type doing most of the
 * work, and colour reserved for meaning rather than decoration.
 *
 * Colour is semantic and never decorative. Each metric owns exactly one hue and
 * keeps it everywhere it appears — a ring, a bar, a sparkline, a share card:
 *
 *   focus     blue    — attention held
 *   recovery  green   — restored capacity
 *   strain    amber   — load carried
 *   scatter   violet  — attention fragmented
 *   record    gold    — an achievement
 *
 * All five clear 6:1 against the canvas, so a value never depends on colour
 * alone but is never illegible when colour carries emphasis.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Canvas — three depths, no more. Cards sit on void, insets on surface.
        void: '#08090C',
        surface: {
          DEFAULT: '#101219',
          raised: '#171A23',
          inset: '#1E222D',
        },
        // Text, as opacity steps of a single near-white so it never tints.
        chalk: {
          DEFAULT: '#F4F6FA',
          70: 'rgba(244,246,250,0.70)',
          45: 'rgba(244,246,250,0.45)',
          30: 'rgba(244,246,250,0.30)',
        },
        hair: {
          DEFAULT: 'rgba(244,246,250,0.09)',
          strong: 'rgba(244,246,250,0.16)',
        },
        // Semantic metric hues.
        focus: { DEFAULT: '#497CFD', dim: 'rgba(73,124,253,0.16)' },
        recovery: { DEFAULT: '#00AA6A', dim: 'rgba(0,170,106,0.16)' },
        strain: { DEFAULT: '#CD7707', dim: 'rgba(205,119,7,0.16)' },
        scatter: { DEFAULT: '#CE52D7', dim: 'rgba(206,82,215,0.16)' },
        record: { DEFAULT: '#F5C451', dim: 'rgba(245,196,81,0.16)' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.045em',
        label: '0.14em',
      },
      borderRadius: {
        card: '18px',
        pill: '999px',
      },
      maxWidth: {
        app: '460px',
        wide: '1140px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        breathe: {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        sweep: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
        breathe: 'breathe 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
