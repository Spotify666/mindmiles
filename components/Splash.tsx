'use client';

import { useEffect, useState } from 'react';

/**
 * THE OPENING.
 *
 * A cold, quiet frame, then the route draws itself, a spark runs the length of
 * it, the mile marker lands, and the name settles. Two and a half seconds, then
 * it gets out of the way.
 *
 * The reference is the moment before a film starts — not the logo itself but
 * the pause around it. Three things do the work:
 *
 *   Anticipation. The screen stays black for a beat before anything moves. A
 *   splash that starts instantly reads as a loading screen; one that waits
 *   reads as deliberate.
 *
 *   A single gesture. One line draws, one spark runs it, one dot lands. No
 *   sequence of unrelated animations — the whole thing is one movement, which
 *   is why it feels like a signature rather than an intro.
 *
 *   The settle. The wordmark arrives wide and tightens into place as it fades
 *   up. That last 200ms of letter-spacing is most of the premium feeling, and
 *   it is the part people cannot name.
 *
 * It plays once per browser session, not per navigation — an entrance that
 * repeats on every tab change stops being an entrance and becomes a toll gate.
 * Tap, press any key, or scroll to skip it. Reduced motion gets the frame
 * without the choreography.
 */

const KEY = 'mindmiles.splash.seen';
const TOTAL_MS = 2650;
const REDUCED_MS = 900;

export default function Splash() {
  /*
   * Starts as 'playing' on both server and client so the markup matches and the
   * overlay is present in the very first paint. On a session where it has
   * already run, an inline script in <head> has stamped `splash-skip` on <html>
   * before this ever renders, and CSS hides it with no frame of flicker; the
   * effect below then unmounts it properly.
   */
  const [state, setState] = useState<'playing' | 'leaving' | 'done'>('playing');
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    // The head script has already made this decision and hidden the overlay.
    if (document.documentElement.classList.contains('splash-skip')) {
      setState('done');
      return;
    }
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      // Private windows throw. Playing once more is the harmless miss.
    }

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReduced(prefersReduced);

    const hold = prefersReduced ? REDUCED_MS : TOTAL_MS;
    const leave = setTimeout(() => setState('leaving'), hold);
    const end = setTimeout(() => setState('done'), hold + 480);
    return () => {
      clearTimeout(leave);
      clearTimeout(end);
    };
  }, []);

  // Skip on any deliberate input.
  useEffect(() => {
    if (state !== 'playing') return;
    const skip = () => setState('leaving');
    window.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip);
    window.addEventListener('wheel', skip, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', skip);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('wheel', skip);
    };
  }, [state]);

  useEffect(() => {
    if (state === 'leaving') {
      const id = setTimeout(() => setState('done'), 480);
      return () => clearTimeout(id);
    }
  }, [state]);

  // While the page is covered, the content behind it must not scroll.
  useEffect(() => {
    if (state === 'playing' || state === 'leaving') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [state]);

  if (state === 'done') return null;

  return (
    <div
      className={`splash ${state === 'leaving' ? 'splash-out' : ''} ${reduced ? 'splash-still' : ''}`}
      aria-hidden
    >
      <div className="splash-stage">
        <svg viewBox="1.45 0 37 37" width="132" height="132" fill="none" className="splash-mark">
          <defs>
            <linearGradient id="splash-route" x1="4" y1="30.5" x2="33" y2="19" gradientUnits="userSpaceOnUse">
              <stop stopColor="#497CFD" />
              <stop offset="0.62" stopColor="#7C9BFF" />
              <stop offset="1" stopColor="#F5C451" />
            </linearGradient>
            <radialGradient id="splash-bloom">
              <stop offset="0%" stopColor="#F5C451" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#F5C451" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* The bloom the marker lands into. */}
          <circle cx="33" cy="19" r="15" fill="url(#splash-bloom)" className="splash-bloom" />

          {/* The route, drawing itself. pathLength normalises the dash maths so
              the timing does not depend on the geometry. */}
          <path
            d="M4,30.5 L11.5,13 L18.5,21.5 L26.5,6.5 L33,19"
            stroke="url(#splash-route)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className="splash-route"
          />

          {/* A spark running the length of it, one beat ahead of nothing. */}
          <path
            d="M4,30.5 L11.5,13 L18.5,21.5 L26.5,6.5 L33,19"
            stroke="#FFFFFF"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className="splash-spark"
          />

          {/* The mile marker, landing. */}
          <g className="splash-node">
            <circle cx="33" cy="19" r={4.9} fill="#08090C" />
            <circle cx="33" cy="19" r={3.3} fill="#F5C451" />
          </g>
        </svg>

        <p className="splash-word">Mind Miles</p>
        <p className="splash-tag">Measure where your attention goes</p>
      </div>
    </div>
  );
}
