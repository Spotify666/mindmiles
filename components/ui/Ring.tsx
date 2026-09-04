'use client';

import { useEffect, useState } from 'react';
import { ACCENT_HEX, type Accent } from './tokens';

/**
 * A circular gauge.
 *
 * The arc is open at the bottom rather than a full circle, which does two
 * things: it gives the value room to sit at optical centre, and it makes the
 * empty portion legible as "not yet" rather than as an error state.
 *
 * The track never disappears. A ring at 4% and a ring that failed to render
 * should not look the same.
 */

const GAP_DEG = 96; // the opening at the bottom
const SWEEP = 360 - GAP_DEG;

export default function Ring({
  value,
  accent = 'focus',
  size = 132,
  thickness = 9,
  label,
  sublabel,
  children,
}: {
  /** 0–100. */
  value: number;
  accent?: Accent;
  size?: number;
  thickness?: number;
  label?: string;
  sublabel?: string;
  children?: React.ReactNode;
}) {
  // Sweeps round on arrival rather than appearing filled. A gauge that is
  // simply drawn at its value looks printed; one that sweeps looks taken.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value]);

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const arc = (SWEEP / 360) * c;
  const filled = (Math.max(0, Math.min(100, shown)) / 100) * arc;
  const hex = ACCENT_HEX[accent];

  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {/* Rotated so the gap sits centred at the bottom. */}
        <g transform={`rotate(${90 + GAP_DEG / 2} ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#DCE6F0"
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${c}`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={hex}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}
            style={{ transition: 'stroke-dasharray 1100ms cubic-bezier(0.16,1,0.3,1)' }}
          />
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children ?? (
          <>
            <span className="readout" style={{ fontSize: size * 0.3 }}>
              {Math.round(value)}
            </span>
            {label && <span className="label mt-1.5 text-ink-faint">{label}</span>}
            {sublabel && <span className="mt-0.5 text-[11px] text-ink-faint">{sublabel}</span>}
          </>
        )}
      </div>
    </div>
  );
}
