'use client';

import { useEffect, useRef, useState } from 'react';
import { fmtClock, fmtCount, fmtDistance, pxToMeters } from '@/lib/mm/format';
import { SOURCE_LABEL, SOURCE_NOTE } from '@/lib/mm/brightness';
import { BURST_VELOCITY, type LiveStats } from '@/lib/mm/tracker';
import { ACCENT_HEX } from '@/components/ui/tokens';
import { useLive } from '@/components/PhotonProvider';
import { Heartbeat } from '@/components/ui/motion';
import {
  enableDeviceAwareness,
  idleDetectionSupported,
  SOURCE_COPY,
} from '@/lib/mm/presence';
import { requestAmbientSensor } from '@/lib/mm/brightness';
import { extensionInstalled } from '@/lib/mm/extension';

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
        ? '#D5DFEA'
        : fresh
          ? ACCENT_HEX.focus
          : 'rgba(26,65,190,0.38)';
      ctx.beginPath();
      ctx.roundRect(i * slot, rect.height - h, barW, h, 1);
      ctx.fill();
    });
  }, [wave, engaged]);

  return <canvas ref={ref} aria-hidden className="h-full w-full" />;
}

function Cell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="panel px-3 py-2.5">
      <p className="label text-ink-faint">{label}</p>
      <p className="readout mt-1.5 text-[19px]">{value}</p>
      {sub && <p className="mt-1 text-[10.5px] text-ink-faint">{sub}</p>}
    </div>
  );
}

export default function LiveNow() {
  // Straight from the 1Hz stream, not from the slow aggregate context — see the
  // note on LiveCtx in PhotonProvider for why that distinction is load-bearing.
  const live = useLive();
  const [asking, setAsking] = useState(false);
  const [askResult, setAskResult] = useState<'granted' | 'refused' | null>(null);

  const source = extensionInstalled() ? 'extension' : (live?.presenceSource ?? 'tab');
  const brightnessSource = live?.brightnessSource ?? 'unset';
  const canGoDeviceWide = !live?.deviceAware && idleDetectionSupported();
  const engaged = live?.engaged ?? false;
  const bout = live?.boutSec ?? 0;
  const overdue = bout >= BREAK_TARGET_SEC;
  const pct = Math.min(100, (bout / BREAK_TARGET_SEC) * 100);
  const remaining = Math.max(0, BREAK_TARGET_SEC - bout);
  const barColor = overdue ? ACCENT_HEX.effort : ACCENT_HEX.focus;

  return (
    <section className="card mm-live-sheen relative overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-ink/15 px-4 py-3">
        <span className="flex items-center gap-2 text-[12.5px] font-semibold">
          <span
            className={`h-2 w-2 rounded-pill ${engaged ? 'animate-breathe' : ''}`}
            style={{ background: engaged ? ACCENT_HEX.rest : '#C3CCD8' }}
            aria-hidden
          />
          {engaged ? 'Watching now' : 'Paused — you are not doing anything'}
        </span>
        <span className="label ml-auto text-ink-faint">Never leaves this device</span>
      </div>

      <div className="grid gap-5 p-4 sm:grid-cols-2">
        <div>
          <p className="label text-ink-faint">Going without a break</p>
          <p className="readout mt-2 text-[42px]" style={{ color: overdue ? ACCENT_HEX.effort : undefined }}>
            {fmtClock(bout)}
          </p>

          <div className="mt-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label text-ink-faint">Next eye break</span>
              <span className="label text-ink-faint" style={{ color: barColor }}>
                {overdue ? `overdue ${fmtClock(bout - BREAK_TARGET_SEC)}` : `in ${fmtClock(remaining)}`}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-paper">
              <div
                className="h-full rounded-pill transition-[width] duration-1000 ease-linear"
                style={{ width: `${pct}%`, background: barColor }}
              />
            </div>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-faint">
              {overdue
                ? 'You have been staring at the same distance for over twenty minutes. Look at something across the room for twenty seconds — this resets when you step away.'
                : 'Every twenty minutes, look at something far away for twenty seconds. This is the timer for that.'}
            </p>
          </div>
        </div>

        <div>
          <p className="label text-ink-faint">What you have been doing · last minute</p>
          <div className="mt-2 h-14 w-full rounded-[12px] bg-paper p-1.5">
            <Wave wave={live?.wave ?? []} engaged={engaged} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <Cell label="Here so far" value={fmtClock(live?.sessionSec ?? 0)} />
            <Cell
              label="Scrolled"
              value={fmtDistance(pxToMeters(live?.scrollPx ?? 0))}
              sub="roughly"
            />
            <Cell label="Keys a minute" value={fmtCount(live?.kpm ?? 0)} sub="just the count" />
            <Cell
              label="Scroll speed"
              value={`${fmtCount(live?.peakVelocity ?? 0)}`}
              sub={live?.bursting ? 'faster than you can read' : 'still readable'}
            />
          </div>
        </div>
      </div>

      {/* What we can and cannot see, said plainly, with the way to widen it. */}
      <div className="border-t border-ink/15 px-4 py-3.5">
        <p className="text-[12.5px] leading-relaxed text-ink-faint">{SOURCE_COPY[source].note}</p>

        {canGoDeviceWide && (
          <button
            type="button"
            disabled={asking}
            onClick={async () => {
              setAsking(true);
              // Both permissions belong to the same intent — "watch my device,
              // not just this tab" — so they are asked for together rather than
              // making the user find brightness in a settings page later.
              const ok = await enableDeviceAwareness();
              await requestAmbientSensor();
              setAskResult(ok ? 'granted' : 'refused');
              setAsking(false);
            }}
            className="mt-3 rounded-pill bg-focus px-4 py-2 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {asking ? 'Asking your browser…' : 'Count my whole device'}
          </button>
        )}

        {askResult === 'refused' && (
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
            Your browser said no, or does not support it. Nothing is broken — we will keep counting
            this tab. The extension in this project counts every tab instead.
          </p>
        )}

        {live && !live.writing && (
          <p className="mt-2.5 text-[12px] leading-relaxed text-ink-faint">
            Photon is open in another tab, and that one is doing the counting — so the same
            minute is never counted twice.
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-ink/15 px-4 py-3">
        <span className="label text-ink-faint">Brightness</span>
        {brightnessSource === 'unset' ? (
          <span className="text-[15px] font-bold text-ink-faint">—</span>
        ) : (
          <span className="text-[15px] font-bold tabular-nums">
            {Math.round(live?.brightness ?? 0)}%
          </span>
        )}
        {live?.lux !== undefined && (
          <span className="text-[12px] tabular-nums text-ink-faint">{live.lux} lux</span>
        )}
        <span
          className={`label rounded-pill px-2 py-0.5 ${
            brightnessSource === 'native' || brightnessSource === 'sensor'
              ? 'border border-rest/40 bg-rest-wash text-rest-text'
              : 'border border-ink/15 bg-paper text-ink-faint'
          }`}
        >
          {SOURCE_LABEL[brightnessSource]}
        </span>
        <p className="w-full text-[11.5px] leading-relaxed text-ink-faint sm:w-auto sm:flex-1">
          {SOURCE_NOTE[brightnessSource]}
        </p>
      </div>
    </section>
  );
}
