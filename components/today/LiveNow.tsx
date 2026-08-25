'use client';

import { useEffect, useRef } from 'react';
import { fmtClock, fmtCount, fmtDistance, pxToMeters } from '@/lib/mm/format';
import { SOURCE_LABEL, SOURCE_NOTE } from '@/lib/mm/brightness';
import { BURST_VELOCITY, type LiveStats } from '@/lib/mm/tracker';
import { ACCENT_HEX } from '@/components/ui/tokens';

/**
 * What is happening right now.
 *
 * A dashboard of yesterday's averages has no weight. A clock you can watch
 * climbing past twenty minutes while you read this sentence does — so the live
 * deck exists, but it is deliberately NOT the top of the screen. The product's
 * claim is that you should not need to sit here watching it; putting a live
 * readout above the day's summary would contradict that in the layout.
 *
 * Every value updates at 1Hz straight from the tracker.
 */

const BREAK_TARGET_SEC = 20 * 60;

/** Sixty one-second samples. Canvas, because sixty SVG rects at 1Hz is wasteful. */
function Wave({ wave, engaged }: { wave: number[]; engaged: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;

    const rect = c.getBoundingClientRect();
    if (rect.width === 0) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.floor(rect.width * dpr);
    c.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const n = wave.length || 1;
    const slot = rect.width / n;
    const barW = Math.max(1.5, slot - 1.5);

    wave.forEach((v, i) => {
      const h = Math.max(2, v * (rect.height - 3));
      // The newest three seconds are the live edge.
      const fresh = i >= n - 3;
      ctx.fillStyle = !engaged
        ? 'rgba(244,246,250,0.12)'
        : fresh
          ? ACCENT_HEX.focus
          : 'rgba(73,124,253,0.42)';
      ctx.beginPath();
      ctx.roundRect(i * slot, rect.height - h, barW, h, 1);
      ctx.fill();
    });
  }, [wave, engaged]);

  return <canvas ref={ref} aria-hidden className="h-full w-full" />;
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[12px] bg-surface-inset px-3 py-2.5">
      <p className="label text-chalk-30">{label}</p>
      <p className="readout mt-1.5 text-[19px]">{value}</p>
      {sub && <p className="mt-1 text-[10.5px] text-chalk-30">{sub}</p>}
    </div>
  );
}

export default function LiveNow({ live }: { live: LiveStats | null }) {
  const engaged = live?.engaged ?? false;
  const bout = live?.boutSec ?? 0;
  const overdue = bout >= BREAK_TARGET_SEC;
  const pct = Math.min(100, (bout / BREAK_TARGET_SEC) * 100);
  const remaining = Math.max(0, BREAK_TARGET_SEC - bout);
  const barColor = overdue ? ACCENT_HEX.strain : ACCENT_HEX.focus;

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-hair px-4 py-3">
        <span className="flex items-center gap-2 text-[12.5px] font-[560]">
          <span
            className={`h-2 w-2 rounded-pill ${engaged ? 'animate-breathe' : ''}`}
            style={{ background: engaged ? ACCENT_HEX.recovery : 'rgba(244,246,250,0.22)' }}
            aria-hidden
          />
          {engaged ? 'Measuring' : 'Idle — no input'}
        </span>
        <span className="label ml-auto text-chalk-30">Stays on this device</span>
      </div>

      <div className="grid gap-5 p-4 sm:grid-cols-2">
        <div>
          <p className="label text-chalk-30">Unbroken stretch</p>
          <p className="readout mt-2 text-[42px]" style={{ color: overdue ? ACCENT_HEX.strain : undefined }}>
            {fmtClock(bout)}
          </p>

          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label text-chalk-30">Eye break</span>
              <span className="label" style={{ color: barColor }}>
                {overdue ? `overdue ${fmtClock(bout - BREAK_TARGET_SEC)}` : `in ${fmtClock(remaining)}`}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-surface-inset">
              <div
                className="h-full rounded-pill transition-[width] duration-1000 ease-linear"
                style={{ width: `${pct}%`, background: barColor }}
              />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-chalk-45">
              {overdue
                ? 'Past twenty minutes at one focal distance. Look at something across the room for twenty seconds — this resets when you step away.'
                : 'Every twenty minutes, twenty seconds at something twenty feet away. This is that clock.'}
            </p>
          </div>
        </div>

        <div>
          <p className="label text-chalk-30">Input · last 60 seconds</p>
          <div className="mt-2 h-14 w-full rounded-[12px] bg-surface-inset p-1.5">
            <Wave wave={live?.wave ?? []} engaged={engaged} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Cell label="Session" value={fmtClock(live?.sessionSec ?? 0)} />
            <Cell
              label="Scroll"
              value={fmtDistance(pxToMeters(live?.scrollPx ?? 0))}
              sub="estimated"
            />
            <Cell label="Keys / min" value={fmtCount(live?.kpm ?? 0)} sub="counts only" />
            <Cell
              label="Scroll speed"
              value={`${fmtCount(live?.peakVelocity ?? 0)}`}
              sub={live?.bursting ? 'above read speed' : `px/s · burst at ${BURST_VELOCITY}`}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hair px-4 py-3">
        <span className="label text-chalk-30">Brightness</span>
        <span className="text-[15px] font-[620] tabular-nums">{Math.round(live?.brightness ?? 0)}%</span>
        {live?.lux !== undefined && <span className="text-[12px] tabular-nums text-chalk-30">{live.lux} lux</span>}
        <span
          className={`label rounded-pill px-2 py-0.5 ${
            live?.brightnessSource === 'declared'
              ? 'border border-strain/25 bg-strain-dim text-strain'
              : 'border border-recovery/25 bg-recovery-dim text-recovery'
          }`}
        >
          {SOURCE_LABEL[live?.brightnessSource ?? 'declared']}
        </span>
        <p className="w-full text-[11.5px] leading-relaxed text-chalk-45 sm:w-auto sm:flex-1">
          {SOURCE_NOTE[live?.brightnessSource ?? 'declared']}
        </p>
      </div>
    </section>
  );
}
