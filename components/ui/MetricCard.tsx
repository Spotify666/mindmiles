'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PROVENANCE_LABEL, PROVENANCE_NOTE, type Metric, type MetricInput } from '@/lib/mm/types';
import Delta from './Delta';
import { Counting } from './motion';
import ProvenanceBadge from './Provenance';
import Sheet from './Sheet';
import { ACCENT_HEX, METRIC_ACCENT } from './tokens';

/**
 * A metric, and the whole of its arithmetic one tap away.
 *
 * The rule: no score here is a black box. But an earlier version proved that
 * transparency delivered badly is its own kind of opaque — every input arrived
 * with a paragraph attached, and the sheet read like a research appendix rather
 * than an answer. People bounced off it, which meant the openness was
 * decorative.
 *
 * So the sheet now front-loads the answer and hides the working:
 *
 *   The number, the word for it, and one sentence. That is the whole answer,
 *   and most people should be able to close the sheet right there.
 *
 *   Under it, one row per input: what it is, what it was, how much it helped.
 *   Scannable in a couple of seconds, with no prose in the way.
 *
 *   A row opens only if you ask it to. The explanation is still there, in full,
 *   for the person who wants it — but nobody has to walk past it to leave.
 */

/** One input, collapsed to a row. Opens to its explanation on tap. */
function InputRow({ input, hex }: { input: MetricInput; hex: string }) {
  const [open, setOpen] = useState(false);
  const scored = typeof input.score === 'number';
  const flagged = input.provenance === 'estimated' || input.provenance === 'unavailable';

  return (
    <li className="border-b border-hair last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full py-3 text-left"
      >
        <div className="flex items-baseline gap-3">
          <span className="min-w-0 flex-1 text-[14px] leading-snug">{input.label}</span>
          <span className="shrink-0 text-[14px] font-[620] tabular-nums">{input.value}</span>
          <span
            className={`shrink-0 text-[11px] leading-none text-chalk-30 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden
          >
            ▾
          </span>
        </div>

        {scored ? (
          <div className="mt-2 flex items-center gap-2.5">
            <div className="h-1 flex-1 overflow-hidden rounded-pill bg-surface-inset">
              <div
                className="h-full rounded-pill"
                style={{ width: `${Math.round(input.score ?? 0)}%`, background: hex, opacity: 0.9 }}
              />
            </div>
            {/* How much this one mattered, in words rather than a weight decimal. */}
            <span className="label shrink-0 text-chalk-30">
              {weightWord(input.weight ?? 0)}
            </span>
          </div>
        ) : (
          <p className="label mt-1.5 text-chalk-30">Background · not part of the score</p>
        )}
      </button>

      {open && (
        <p className="pb-3.5 text-[13px] leading-relaxed text-chalk-45">
          {input.detail}
          {flagged && (
            <span className="mt-2 block">
              <ProvenanceBadge provenance={input.provenance} />
            </span>
          )}
        </p>
      )}
    </li>
  );
}

/** Weights are shares of a score, and "0.34" is not how anyone thinks about that. */
function weightWord(weight: number): string {
  if (weight >= 0.3) return 'counts a lot';
  if (weight >= 0.2) return 'counts a fair bit';
  if (weight > 0) return 'counts a little';
  return '';
}

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
  const unavailable = metric.provenance === 'unavailable';

  return (
    <Sheet open={open} onClose={onClose} title={metric.label}>
      {/* ── the answer ────────────────────────────────────── */}
      <p className="text-[13px] text-chalk-45">{metric.plain}</p>

      <div className="mt-3 flex items-end gap-4">
        <span className="readout text-[60px]" style={{ color: unavailable ? undefined : hex }}>
          {unavailable ? '—' : <Counting value={metric.value} duration={650} />}
        </span>
        <div className="pb-2">
          <p className="text-[17px] font-[620] leading-none">{metric.bandLabel}</p>
          <p className="mt-2 text-[13.5px] font-[560] tabular-nums text-chalk-70">{metric.fact}</p>
          <p className="label mt-1.5 text-chalk-30">
            {metric.polarity === 'higher-better' ? 'Higher is better' : 'Lower is easier'}
          </p>
        </div>
      </div>

      <p className="mt-3.5 text-[15px] leading-relaxed text-chalk-70">{metric.headline}</p>

      {metric.delta && (
        <p className="mt-3 text-[13.5px] leading-relaxed text-chalk-45">
          Your usual for this kind of day is{' '}
          <span className="font-[620] text-chalk">{Math.round(metric.delta.baseline)}</span>. Today is{' '}
          <span className={metric.delta.better ? 'font-[620] text-recovery' : 'font-[620] text-strain'}>
            {Math.abs(Math.round(metric.delta.change))} {metric.delta.change >= 0 ? 'higher' : 'lower'}
          </span>
          .
        </p>
      )}

      {/* ── the working, only if you want it ──────────────── */}
      <p className="label mt-7 text-chalk-30">What made this number</p>
      {/*
        The bars show how much each thing pushed the score, and for a
        lower-is-better metric that means a long bar is bad news. Leaving that
        unsaid teaches people to read the sheet backwards.
      */}
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-chalk-30">
        {metric.polarity === 'higher-better'
          ? 'Longer bars pushed your score up. Tap any line to see why it matters.'
          : 'Longer bars pushed your score up — and here, lower is easier. Tap any line to see why.'}
      </p>

      <ul className="mt-2">
        {metric.inputs.map((input) => (
          <InputRow key={input.label} input={input} hex={hex} />
        ))}
      </ul>

      <p className="mt-5 text-[12.5px] leading-relaxed text-chalk-30">
        <Link href="/guide" className="text-chalk-45 underline underline-offset-2 hover:text-chalk">
          What all the numbers mean
        </Link>
      </p>

      {/* ── where the number came from ────────────────────── */}
      <div className="mt-5 rounded-[14px] bg-surface-raised p-3.5">
        <ProvenanceBadge provenance={metric.provenance} />
        <p className="mt-2 text-[12.5px] leading-relaxed text-chalk-45">
          {PROVENANCE_NOTE[metric.provenance]}
        </p>
      </div>
    </Sheet>
  );
}

/**
 * The compact card in the Today grid. The whole card is the tap target — a
 * small "info" affordance beside a big number teaches people the explanation is
 * optional, and here it is the point.
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
        aria-label={`${metric.label}: ${unavailable ? 'no score yet' : metric.value}. ${metric.plain}. Tap to see how it works.`}
        className="card group w-full p-4 text-left transition-colors hover:border-hair-strong hover:bg-surface-raised"
      >
        {/* The name gets the row to itself. Sharing it with the badge pushed
            the pill off the edge of a two-up phone card. */}
        <span className="label block truncate text-chalk-45">{metric.label}</span>

        {/*
          The plain-English line is not optional chrome — it is what makes the
          metric name mean anything to someone reading it for the first time.

          Two lines are reserved for it whether or not it needs them, and the
          badge sits inline at the end rather than on a row of its own. Both are
          about the grid: cards whose height depends on how long their sentence
          happens to be, or on whether they carry a badge, come out ragged in a
          two-up phone layout.
        */}
        <p className="mt-1 min-h-[2.5em] text-[11.5px] leading-snug text-chalk-30">
          {metric.plain}
          {metric.provenance === 'estimated' && (
            <ProvenanceBadge provenance="estimated" className="ml-1.5 align-[1px]" />
          )}
        </p>

        <div className="mt-2.5 flex items-end gap-2">
          <span className="readout text-[34px]" style={{ color: unavailable ? undefined : hex }}>
            {unavailable ? '—' : <Counting value={metric.value} />}
          </span>
          <span className="pb-1 text-[13px] text-chalk-45">{metric.bandLabel}</span>
        </div>

        {/*
          The concrete measurement, in minutes and counts. Six scores out of 100
          are indistinguishable from one another however carefully they are
          named — this line is what makes it obvious that Rest and Jumpiness are
          measuring two completely different things, and it is the part anyone
          can actually act on.
        */}
        <p className="mt-1.5 text-[12.5px] font-[560] tabular-nums text-chalk-70">{metric.fact}</p>

        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-pill bg-surface-inset">
          <div
            className="h-full rounded-pill transition-[width] duration-700"
            style={{ width: unavailable ? '0%' : `${metric.value}%`, background: hex, opacity: 0.9 }}
          />
        </div>

        {!compact && <Delta delta={metric.delta} className="mt-2.5 block" />}
      </button>

      <MetricExplain metric={metric} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export { PROVENANCE_LABEL };
