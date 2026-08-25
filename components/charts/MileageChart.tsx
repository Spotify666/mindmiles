'use client';

import { useState } from 'react';
import { fmtMiles, fmtMin, weekdayShort } from '@/lib/mm/format';
import type { DaySummary } from '@/lib/mm/types';
import { ACCENT_HEX, CLASS_ACCENT, CLASS_LABEL, CLASS_ORDER, GRID, SURFACE } from '@/components/ui/tokens';
import Legend from './Legend';

/**
 * Mind Miles per day, split by how the mileage was spent.
 *
 * Part-to-whole across ordered time buckets, so: stacked bars on one axis.
 * Never two axes — mileage and any second measure would need a second chart.
 *
 * Segments carry a 2px surface gap between them, the data-end of each bar is
 * rounded while the baseline end stays square, and the legend names all three
 * classes with their totals. That combination is what makes the palette's
 * colour-deficiency margin acceptable.
 */

const W = 720;
const H = 190;
const PAD = { top: 12, right: 6, bottom: 26, left: 30 };

export default function MileageChart({
  days,
  selected,
  onSelect,
  title = 'Mind Miles',
}: {
  days: DaySummary[];
  selected?: string;
  onSelect?: (date: string) => void;
  title?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const peak = Math.max(2, ...days.map((d) => d.miles.total));
  const max = Math.ceil(peak / 5) * 5 || 5;
  const band = plotW / Math.max(days.length, 1);
  const barW = Math.max(4, Math.min(30, band - (days.length > 14 ? 3 : 9)));

  const totals = days.reduce(
    (acc, d) => ({
      focus: acc.focus + d.miles.focus,
      scatter: acc.scatter + d.miles.scatter,
      scroll: acc.scroll + d.miles.scroll,
    }),
    { focus: 0, scatter: 0, scroll: 0 },
  );
  const grand = totals.focus + totals.scatter + totals.scroll;

  const y = (miles: number) => PAD.top + plotH - (miles / max) * plotH;

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[14px] font-[620]">{title}</span>
        <span className="label text-chalk-30">{fmtMiles(grand)} mi over {days.length} days</span>
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Mind Miles per day. ${fmtMiles(grand)} miles total: ${fmtMiles(totals.focus)} focus, ${fmtMiles(totals.scatter)} scattered, ${fmtMiles(totals.scroll)} scroll.`}
        >
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text
                x={PAD.left - 7}
                y={y(t) + 3.5}
                textAnchor="end"
                fontSize={9}
                fill="rgba(244,246,250,0.30)"
                fontFamily="var(--font-mono)"
              >
                {Math.round(t)}
              </text>
            </g>
          ))}

          {days.map((d, i) => {
            const x = PAD.left + i * band + (band - barW) / 2;
            const isSel = selected === d.date;
            const dim = (hover !== null && hover !== i) || (selected !== undefined && !isSel && hover === null);

            let cursor = 0;
            return (
              <g
                key={d.date}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onClick={onSelect ? () => onSelect(d.date) : undefined}
                className={onSelect ? 'cursor-pointer' : undefined}
                opacity={dim ? 0.45 : 1}
                style={{ transition: 'opacity 160ms' }}
              >
                {CLASS_ORDER.map((cls) => {
                  const v = d.miles[cls];
                  if (v <= 0.02) return null;
                  const top = y(cursor + v);
                  const bottom = y(cursor);
                  cursor += v;
                  const h = Math.max(1.5, bottom - top);
                  // Only the topmost segment gets a rounded data-end; the rest
                  // stay square so the stack reads as one bar.
                  const isTop = Math.abs(cursor - d.miles.total) < 0.03;
                  const r = isTop ? Math.min(4, h / 2, barW / 2) : 0;
                  return (
                    <path
                      key={cls}
                      d={`M${x},${top + h} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + barW - r},${top} Q${x + barW},${top} ${x + barW},${top + r} L${x + barW},${top + h} Z`}
                      fill={ACCENT_HEX[CLASS_ACCENT[cls]]}
                      stroke={SURFACE}
                      strokeWidth={2}
                    />
                  );
                })}

                {/* Hit target, larger than the mark. */}
                <rect x={PAD.left + i * band} y={PAD.top} width={band} height={plotH} fill="transparent" />

                {isSel && (
                  <rect x={x} y={PAD.top + plotH + 4} width={barW} height={2} rx={1} fill="#F4F6FA" />
                )}
              </g>
            );
          })}

          {/* x labels: every day for a week, every fifth for a month. */}
          {days.map((d, i) => {
            const step = days.length > 10 ? 5 : 1;
            if (i % step !== 0 && i !== days.length - 1) return null;
            return (
              <text
                key={d.date}
                x={PAD.left + i * band + band / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize={9}
                fill="rgba(244,246,250,0.30)"
                fontFamily="var(--font-mono)"
              >
                {days.length > 10 ? d.date.slice(8) : weekdayShort(d.date)}
              </text>
            );
          })}
        </svg>

        {hover !== null && days[hover] && (
          <div
            className="pointer-events-none absolute z-10 rounded-[10px] border border-hair-strong bg-surface-raised px-3 py-2 shadow-lg"
            style={{
              left: `${((PAD.left + hover * band + band / 2) / W) * 100}%`,
              top: 0,
              transform: 'translate(-50%,-104%)',
            }}
          >
            <p className="label whitespace-nowrap text-chalk-30">{days[hover].date}</p>
            <p className="mt-0.5 whitespace-nowrap text-[14px] font-[620] tabular-nums">
              {fmtMiles(days[hover].miles.total)} mi · {fmtMin(days[hover].activeMin)}
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {CLASS_ORDER.map((cls) => (
                <li key={cls} className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px]">
                  <span
                    className="h-2 w-2 shrink-0 rounded-[2px]"
                    style={{ background: ACCENT_HEX[CLASS_ACCENT[cls]] }}
                  />
                  <span className="text-chalk-45">{CLASS_LABEL[cls]}</span>
                  <span className="ml-auto pl-2 font-[620] tabular-nums">
                    {fmtMiles(days[hover].miles[cls])}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <Legend
        className="mt-3.5"
        items={CLASS_ORDER.map((c) => ({
          label: CLASS_LABEL[c],
          accent: CLASS_ACCENT[c],
          value: `${fmtMiles(totals[c])} mi`,
        }))}
      />
    </figure>
  );
}
