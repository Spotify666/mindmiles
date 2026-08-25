'use client';

import { useState } from 'react';
import { fmtMin, fmtRange, fmtTimeOfDay } from '@/lib/mm/format';
import type { DaySummary, MinuteClass } from '@/lib/mm/types';
import { ACCENT_HEX, CLASS_ACCENT, CLASS_LABEL, CLASS_NOTE, GRID, SURFACE } from '@/components/ui/tokens';
import Legend from './Legend';

/**
 * The day, as one strip.
 *
 * The form is a timeline band rather than a bar chart because the question it
 * answers is "what shape was the day", not "how much of each thing" — position
 * along the strip carries the meaning, and the eye reads the rhythm of gaps and
 * blocks before it reads any number.
 *
 * Recovery windows are drawn as gaps rather than as a fourth colour. A break is
 * the absence of screen time, and drawing it as a filled category would be a
 * lie about what was measured.
 *
 * Adjacent runs are separated by a 2px surface gap, and every class is named in
 * the legend with its total — required, because the palette's worst
 * colour-deficiency pair is in the band where colour cannot carry identity alone.
 */

const H = 74;
const BAND_TOP = 16;
const BAND_H = 34;

interface Run {
  start: number;
  end: number;
  cls: MinuteClass;
}

/**
 * Collapse the per-minute map into runs of one class.
 *
 * Micro-gaps are bridged. A minute where you glanced away is not the end of a
 * session — the bout logic already treats gaps of five minutes or less as
 * pauses inside a stretch, and the timeline has to agree with it, or a single
 * two-hour block renders as forty slivers and the chart contradicts the number
 * printed beside it.
 */
const BRIDGE_MIN = 5;

function runsOf(minuteClass: Record<number, MinuteClass>): Run[] {
  const minutes = Object.keys(minuteClass)
    .map(Number)
    .sort((a, b) => a - b);

  const runs: Run[] = [];
  for (const m of minutes) {
    const cls = minuteClass[m];
    const last = runs[runs.length - 1];
    if (last && last.cls === cls && m - last.end <= BRIDGE_MIN) last.end = m;
    else runs.push({ start: m, end: m, cls });
  }
  return runs;
}

export default function DayTimeline({ day, title = 'Your day' }: { day: DaySummary; title?: string }) {
  const [hover, setHover] = useState<Run | null>(null);

  const runs = runsOf(day.minuteClass);
  const totals = { focus: day.miles.focus * 20, scatter: day.miles.scatter * 20, scroll: day.miles.scroll * 20 };
  const x = (min: number) => (min / 1440) * 100;

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-[14px] font-[620]">{title}</span>
        <span className="label text-chalk-30">
          {day.firstEngagedMin !== null && day.lastEngagedMin !== null
            ? fmtRange(day.firstEngagedMin, day.lastEngagedMin)
            : 'No sessions yet'}
        </span>
      </figcaption>

      <div className="relative">
        <svg
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          className="h-[74px] w-full"
          role="img"
          aria-label={`Timeline of the day. ${fmtMin(day.activeMin)} engaged across ${day.bouts.length} sessions, with ${day.breakCount} breaks of ten minutes or more.`}
        >
          {/* Empty track. A day with no data must not look like a failed render. */}
          <rect x={0} y={BAND_TOP} width={100} height={BAND_H} rx={1.5} fill="rgba(244,246,250,0.05)" />

          {/* Hour rules, recessive, every three hours. */}
          {Array.from({ length: 9 }, (_, i) => i * 3).map((h) => (
            <line
              key={h}
              x1={x(h * 60)}
              x2={x(h * 60)}
              y1={BAND_TOP}
              y2={BAND_TOP + BAND_H}
              stroke={GRID}
              strokeWidth={0.12}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Engaged runs. The 2px surface gap is drawn as an inset stroke so it
              survives the non-uniform scaling of preserveAspectRatio="none". */}
          {runs.map((r) => {
            const w = x(r.end + 1) - x(r.start);
            const dim = hover !== null && hover !== r;
            // The 2px separator is only drawn where the run is wide enough to
            // survive it. On a narrow phone a ten-minute run is under a pixel
            // of stroke away from vanishing entirely, and a segment that is all
            // separator is worse than one with no separator at all.
            const wide = w > 1.2;
            return (
              <rect
                key={`${r.start}-${r.cls}`}
                x={x(r.start)}
                y={BAND_TOP}
                width={Math.max(w, 0.2)}
                height={BAND_H}
                rx={0.6}
                fill={ACCENT_HEX[CLASS_ACCENT[r.cls]]}
                stroke={wide ? SURFACE : undefined}
                strokeWidth={wide ? 2 : undefined}
                vectorEffect="non-scaling-stroke"
                opacity={dim ? 0.35 : 1}
                style={{ transition: 'opacity 160ms' }}
                onMouseEnter={() => setHover(r)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}

          {/* Recovery windows: a rule beneath the band, not a filled category. */}
          {day.breaks.map((b) => (
            <line
              key={b.startMin}
              x1={x(b.startMin)}
              x2={x(b.endMin + 1)}
              y1={BAND_TOP + BAND_H + 5}
              y2={BAND_TOP + BAND_H + 5}
              stroke={ACCENT_HEX.recovery}
              strokeWidth={2.5}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {/* Hour labels sit outside the SVG so they are not stretched by the
            non-uniform viewBox. */}
        <div className="mt-1 flex justify-between">
          {[0, 6, 12, 18, 24].map((h) => (
            <span key={h} className="label text-chalk-30">
              {h === 24 ? '24:00' : fmtTimeOfDay(h * 60)}
            </span>
          ))}
        </div>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-[10px] border border-hair-strong bg-surface-raised px-2.5 py-2 shadow-lg"
            style={{ left: `${Math.min(88, Math.max(12, x(hover.start) + (x(hover.end + 1) - x(hover.start)) / 2))}%`, top: -8, transform: 'translate(-50%,-100%)' }}
          >
            <p className="label text-chalk-30">{fmtRange(hover.start, hover.end)}</p>
            <p className="mt-0.5 text-[13px] font-[620]">
              {CLASS_LABEL[hover.cls]} · {fmtMin(hover.end - hover.start + 1)}
            </p>
          </div>
        )}
      </div>

      <Legend
        className="mt-3.5"
        items={[
          // Spelled out as "min": this legend sits near a scroll distance in
          // metres, and "50m" next to "35 m" reads as two of the same unit.
          ...(['focus', 'scatter', 'scroll'] as const).map((c) => ({
            label: CLASS_LABEL[c],
            accent: CLASS_ACCENT[c],
            value: `${Math.round(totals[c])} min`,
            note: CLASS_NOTE[c],
          })),
          {
            label: 'Recovery',
            accent: 'recovery' as const,
            value: `${day.breakCount}`,
            note: 'Gaps of 10 minutes or more.',
          },
        ]}
      />
    </figure>
  );
}
