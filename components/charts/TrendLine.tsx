'use client';

import { useState } from 'react';
import { fmtDate } from '@/lib/mm/format';
import { ACCENT_HEX, GRID, SURFACE, type Accent } from '@/components/ui/tokens';

/**
 * One measure over time.
 *
 * A single series, so no legend box — the title names it. There is a crosshair
 * and a tooltip because an SVG chart on a page is interactive whether or not it
 * was designed to be, and a line without a readout makes people guess at values.
 *
 * The baseline band is an annotation, not a second series: it shows the user's
 * own normal as a horizontal reference so the line can be read against
 * something. A second y-axis would be the alternative, and there is never a
 * second y-axis.
 */

const W = 720;
const H = 180;
const PAD = { top: 14, right: 10, bottom: 24, left: 30 };

export interface TrendPoint {
  date: string;
  value: number;
  /** Points with no measurement are drawn as gaps, never interpolated over. */
  missing?: boolean;
}

export default function TrendLine({
  points,
  accent = 'focus',
  title,
  baseline,
  domain = [0, 100],
  unit = '',
}: {
  points: TrendPoint[];
  accent?: Accent;
  title: string;
  /** The user's own normal, drawn as a reference rule. */
  baseline?: number;
  domain?: [number, number];
  unit?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const hex = ACCENT_HEX[accent];

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const [lo, hi] = domain;

  const x = (i: number) => PAD.left + (i / Math.max(points.length - 1, 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - lo) / Math.max(hi - lo, 1)) * plotH;

  // Segments split on gaps, so a day without measurement is a break in the line
  // rather than a straight run between two distant points.
  const segments: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p.missing) {
      if (current.length > 1) segments.push(current.join(' '));
      current = [];
      return;
    }
    current.push(`${current.length === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(p.value).toFixed(2)}`);
  });
  if (current.length > 1) segments.push(current.join(' '));

  const present = points.filter((p) => !p.missing);
  const latest = present[present.length - 1];

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[14px] font-bold">{title}</span>
        {latest && (
          <span className="label text-ink-faint">
            Now {Math.round(latest.value)}
            {unit}
          </span>
        )}
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${title} over ${points.length} days.${latest ? ` Most recent value ${Math.round(latest.value)}${unit}.` : ''}`}
        >
          {[lo, (lo + hi) / 2, hi].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text
                x={PAD.left - 7}
                y={y(t) + 3.5}
                textAnchor="end"
                fontSize={9}
                fill="#646D7B"
                fontFamily="var(--font-sans)"
              >
                {Math.round(t)}
              </text>
            </g>
          ))}

          {baseline !== undefined && (
            <>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(baseline)}
                y2={y(baseline)}
                stroke="#14181F"
                strokeWidth={1.5}
                strokeDasharray="5 4"
              />
              {/* Anchored left, above the rule: the series reaches the right
                  edge and the label collided with it there. */}
              <text
                x={PAD.left + 4}
                y={y(baseline) - 6}
                textAnchor="start"
                fontSize={9}
                fill="#646D7B"
                fontFamily="var(--font-sans)"
              >
                YOUR NORMAL
              </text>
            </>
          )}

          {segments.map((d) => (
            <path key={d.slice(0, 24)} d={d} fill="none" stroke={hex} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          ))}

          {hover !== null && !points[hover].missing && (
            <>
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={PAD.top + plotH}
                stroke="rgba(20,24,31,0.35)"
                strokeWidth={1}
              />
              <circle cx={x(hover)} cy={y(points[hover].value)} r={5} fill={hex} stroke={SURFACE} strokeWidth={2} />
            </>
          )}

          {/* Hit targets, wider than the marks. */}
          {points.map((p, i) => (
            <rect
              key={p.date}
              x={x(i) - plotW / Math.max(points.length, 1) / 2}
              y={PAD.top}
              width={plotW / Math.max(points.length, 1)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}

          {points.map((p, i) => {
            const step = Math.max(1, Math.floor(points.length / 5));
            if (i % step !== 0 && i !== points.length - 1) return null;
            return (
              <text
                key={p.date}
                x={x(i)}
                y={H - 7}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                fontSize={9}
                fill="#646D7B"
                fontFamily="var(--font-sans)"
              >
                {p.date.slice(5)}
              </text>
            );
          })}
        </svg>

        {hover !== null && !points[hover].missing && (
          <div
            className="pointer-events-none absolute z-10 rounded-[10px] border border-ink bg-paper px-3 py-2 shadow-lg"
            style={{ left: `${(x(hover) / W) * 100}%`, top: 0, transform: 'translate(-50%,-104%)' }}
          >
            <p className="label whitespace-nowrap text-ink-faint">{fmtDate(points[hover].date)}</p>
            <p className="mt-0.5 whitespace-nowrap text-[15px] font-bold tabular-nums" style={{ color: hex }}>
              {Math.round(points[hover].value)}
              {unit}
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}
