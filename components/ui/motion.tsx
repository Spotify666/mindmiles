'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * MOVEMENT, USED SPARINGLY AND ON PURPOSE.
 *
 * A measurement app that renders its numbers instantly reads as a printout.
 * The same numbers arriving — counting up, a ring sweeping round, cards landing
 * one after another — read as an instrument taking a reading. Same data, and a
 * completely different impression of whether anything is happening.
 *
 * Two rules keep it from becoming decoration:
 *
 *   Motion runs once, on arrival. Nothing here loops, pulses or breathes for
 *   the sake of it. The only continuously moving things in the app are the ones
 *   genuinely changing every second — the live clock and the waveform.
 *
 *   Everything degrades to the final state. Under reduced motion, or if a timer
 *   never fires, you get the number. Nothing is only visible mid-animation.
 */

function prefersReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Count a number up to its value on first paint, and animate between values
 * afterwards.
 *
 * Eased rather than linear: a number that decelerates into place looks like it
 * is settling on a reading, and one that stops dead looks like it was cut off.
 */
export function useCountUp(value: number, { duration = 850, decimals = 0 } = {}): number {
  const [shown, setShown] = useState(() => (prefersReduced() ? value : 0));
  const from = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReduced()) {
      setShown(value);
      return;
    }

    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;
    if (delta === 0) {
      setShown(value);
      return;
    }

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — fast off the mark, settling rather than stopping.
      const eased = 1 - Math.pow(1 - t, 3);
      const next = origin + delta * eased;
      const rounded = decimals > 0 ? Number(next.toFixed(decimals)) : Math.round(next);
      setShown(rounded);
      if (t < 1) frame.current = requestAnimationFrame(step);
      else from.current = value;
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      // Whatever happens, the true value is where we are counting from next.
      from.current = value;
    };
  }, [value, duration, decimals]);

  return shown;
}

/** A number that counts up to itself. */
export function Counting({
  value,
  decimals = 0,
  duration,
  className,
  style,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const shown = useCountUp(value, { duration, decimals });
  return (
    <span className={className} style={style}>
      {decimals > 0 ? shown.toFixed(decimals) : Math.round(shown)}
    </span>
  );
}

/**
 * Stagger children in as the screen arrives.
 *
 * The delay is capped: past about half a second the last card in a grid feels
 * late rather than choreographed, and on a slow connection a long stagger reads
 * as the page still loading.
 */
export function Enter({
  index = 0,
  className = '',
  children,
  as: Tag = 'div',
}: {
  index?: number;
  className?: string;
  children: React.ReactNode;
  as?: 'div' | 'section' | 'li';
}) {
  const delay = Math.min(index * 55, 440);
  return (
    <Tag className={`mm-enter ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
}

/**
 * A live seconds pulse. The point is not the dot — it is that something on the
 * screen is visibly keeping time, so the readings look taken rather than
 * printed.
 */
export function Heartbeat({ active }: { active: boolean }) {
  return (
    <span
      className={`relative flex h-2 w-2 shrink-0 ${active ? '' : 'opacity-40'}`}
      aria-hidden
    >
      {active && (
        <span className="mm-ping absolute inline-flex h-full w-full rounded-pill bg-recovery" />
      )}
      <span
        className="relative inline-flex h-2 w-2 rounded-pill"
        style={{ background: active ? '#00AA6A' : 'rgba(244,246,250,0.25)' }}
      />
    </span>
  );
}
