'use client';

import { useEffect, useState } from 'react';
import { PARTICLE, WAVE_PATH } from '@/components/brand/Logo';

/**
 * THE OPENING.
 *
 * A quiet paper frame, then the wave draws itself, a spark runs its length, the
 * particle lands, and the name settles. Two and a half seconds, then it gets out
 * of the way.
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
 *
 * It does NOT play on a first visit. The welcome is the entrance for someone
 * arriving for the first time, and a title card in front of it only hides the
 * one screen that explains what they have opened.
 *
 * And it can never trap anyone. The overlay is server-rendered visible and
 * normally removed by React — so if scripting is slow, blocked or broken, a CSS
 * failsafe fades it out and makes it click-through on its own. A splash screen
 * that can become a permanent black page is not a splash screen, it is an
 * outage.
 */

const KEY = 'photon.splash.seen';
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
        <svg viewBox="0 0 44 24" width="220" height="120" fill="none" className="splash-mark">
          <defs>
            <radialGradient id="splash-bloom">
              <stop offset="0%" stopColor="#2B90E0" stopOpacity="0.30" />
              <stop offset="100%" stopColor="#2B90E0" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* The glow the particle lands into. */}
          <circle cx={PARTICLE.x} cy={PARTICLE.y} r="11" fill="url(#splash-bloom)" className="splash-bloom" />

          {/* The wave, drawing itself. pathLength normalises the dash maths so
              the timing does not depend on the geometry. */}
          <path
            d={WAVE_PATH}
            stroke="#2B90E0"
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className="splash-route"
          />

          {/* A spark running its length, one beat ahead of nothing. */}
          <path
            d={WAVE_PATH}
            stroke="#8FC8F2"
            strokeWidth={3.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            className="splash-spark"
          />

          {/* The particle, arriving. */}
          <circle
            cx={PARTICLE.x}
            cy={PARTICLE.y}
            r={PARTICLE.r}
            fill="#2B90E0"
            className="splash-node"
          />
        </svg>

        <p className="splash-word">photon</p>
        <p className="splash-tag">See what your screens are really doing</p>
      </div>
    </div>
  );
}
