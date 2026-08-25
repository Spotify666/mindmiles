'use client';

import { useState } from 'react';
import { PROVENANCE_NOTE, type Metric } from '@/lib/mm/types';
import Delta from './Delta';
import ProvenanceBadge from './Provenance';
import Sheet from './Sheet';
import { ACCENT_HEX, METRIC_ACCENT } from './tokens';

/**
 * A metric, and the whole of its arithmetic one tap away.
 *
 * The rule this component exists to enforce: no score in this product is a
 * black box. Every card opens a sheet listing each input, that input's own
 * 0–100 contribution, the weight it carried, where the underlying value came
 * from, and why it belongs in the metric at all. If a number cannot survive
 * being shown that way, it should not be on the screen.
 */

export function MetricExplain({
  metric,
  open,
  onClose,
}: {
  metric: Metric;
  open: boolean;
  onClose: () => void;
}) {
  const hex = ACCENT_HEX[METRIC_ACCENT[metric.id]];
  const scored = metric.inputs.filter((i) => typeof i.weight === 'number');
  const context = metric.inputs.filter((i) => typeof i.weight !== 'number');

  return (
    <Sheet open={open} onClose={onClose} title={`How ${metric.label} is calculated`}>
      <div className="flex items-end gap-4">
        <span className="readout text-[56px]" style={{ color: hex }}>
          {metric.provenance === 'unavailable' ? '—' : metric.value}
        </span>
        <div className="pb-2">
          <p className="text-[15px] font-[620]">{metric.bandLabel}</p>
          <p className="label mt-1 text-chalk-30">
            {metric.polarity === 'higher-better' ? 'Higher is better' : 'Lower is lighter'}
          </p>
        </div>
      </div>

      <p className="mt-4 text-[14px] leading-relaxed text-chalk-70">{metric.headline}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ProvenanceBadge provenance={metric.provenance} />
        <p className="text-[12px] leading-relaxed text-chalk-45">
          {PROVENANCE_NOTE[metric.provenance]}
        </p>
      </div>

      {scored.length > 0 && (
        <>
          <p className="label mt-7 text-chalk-30">The arithmetic</p>
          <ul className="mt-3 space-y-3">
            {scored.map((input) => (
              <li key={input.label} className="rounded-[14px] border border-hair bg-surface-raised p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-[14px] font-[560]">{input.label}</span>
                  <span className="text-[14px] font-[620] tabular-nums">{input.value}</span>
                </div>

                {typeof input.score === 'number' && (
                  <div className="mt-2.5">
                    {/* The bar is the input's own 0–100 contribution; the number
                        beside it is the weight that contribution carried. */}
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-inset">
                        <div
                          className="h-full rounded-pill"
                          style={{ width: `${Math.round(input.score)}%`, background: hex, opacity: 0.85 }}
                        />
                      </div>
                      <span className="label shrink-0 text-chalk-30">
                        {Math.round(input.score)} × {Math.round((input.weight ?? 0) * 100)}%
                      </span>
                    </div>
                  </div>
                )}

                <p className="mt-2.5 text-[12.5px] leading-relaxed text-chalk-45">{input.detail}</p>
                <div className="mt-2">
                  <ProvenanceBadge provenance={input.provenance} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {context.length > 0 && (
        <>
          <p className="label mt-7 text-chalk-30">Context · carries no weight</p>
          <ul className="mt-3 space-y-3">
            {context.map((input) => (
              <li key={input.label} className="rounded-[14px] border border-hair p-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-[14px] font-[560]">{input.label}</span>
                  <span className="text-[14px] font-[620] tabular-nums">{input.value}</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-chalk-45">{input.detail}</p>
                <div className="mt-2">
                  <ProvenanceBadge provenance={input.provenance} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {metric.delta && (
        <div className="mt-7 rounded-[14px] border border-hair p-3.5">
          <p className="label text-chalk-30">Against your baseline</p>
          <p className="mt-2 text-[14px] leading-relaxed text-chalk-70">
            Your normal for this kind of day is{' '}
            <span className="font-[620] text-chalk">{Math.round(metric.delta.baseline)}</span>, taken as
            the median of {metric.delta.samples} comparable days. Today is{' '}
            <span className={metric.delta.better ? 'font-[620] text-recovery' : 'font-[620] text-strain'}>
              {metric.delta.change >= 0 ? '+' : '−'}
              {Math.abs(Math.round(metric.delta.change))}
            </span>{' '}
            against it.
          </p>
        </div>
      )}
    </Sheet>
  );
}

/**
 * The compact card used in the Today grid. Tapping anywhere on it opens the
 * explain sheet — the whole card is the affordance, because a small "info"
 * target next to a big number teaches people the explanation is optional.
 */
export default function MetricCard({ metric, compact = false }: { metric: Metric; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const hex = ACCENT_HEX[METRIC_ACCENT[metric.id]];
  const unavailable = metric.provenance === 'unavailable';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="card group w-full p-4 text-left transition-colors hover:border-hair-strong hover:bg-surface-raised"
      >
        <div className="flex items-baseline justify-between gap-2">
          <span className="label text-chalk-45">{metric.label}</span>
          {metric.provenance === 'estimated' && <ProvenanceBadge provenance="estimated" />}
        </div>

        <div className="mt-2.5 flex items-end gap-2">
          <span className="readout text-[34px]" style={{ color: unavailable ? undefined : hex }}>
            {unavailable ? '—' : metric.value}
          </span>
          <span className="pb-1 text-[13px] text-chalk-45">{metric.bandLabel}</span>
        </div>

        {/* A linear track rather than a second ring: six rings in a grid is a
            dashboard, and a dashboard is what this screen is trying not to be. */}
        <div className="mt-3 h-1 w-full overflow-hidden rounded-pill bg-surface-inset">
          <div
            className="h-full rounded-pill transition-[width] duration-700"
            style={{
              width: unavailable ? '0%' : `${metric.value}%`,
              background: hex,
              opacity: 0.9,
            }}
          />
        </div>

        {/* The delta stands alone. An "Explain" affordance beside it wrapped to
            two lines in the two-up phone grid, and the whole card is the tap
            target anyway — the hint below the grid says so once. */}
        {!compact && <Delta delta={metric.delta} className="mt-2.5 block" />}
      </button>

      <MetricExplain metric={metric} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
