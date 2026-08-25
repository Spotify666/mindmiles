'use client';

import Link from 'next/link';
import { fmtDate, fmtMin, fmtMiles } from '@/lib/mm/format';
import type { Insight, PersonalRecord, Reclaimed } from '@/lib/mm/types';
import { ACCENT_HEX, type Accent } from '@/components/ui/tokens';

/**
 * The narrative cards on Today.
 *
 * Between them they carry the tone of the whole product, so the rules are
 * strict: describe behaviour rather than the person, never use a number without
 * saying what it is compared against, and never end on a fault. The Win card is
 * placed above One Thing for exactly that reason.
 */

export function StoryCard({ story }: { story: string }) {
  return (
    <section className="card p-4">
      <p className="label text-chalk-30">Today&rsquo;s story</p>
      <p className="mt-2.5 text-[15px] leading-relaxed text-chalk-70">{story}</p>
    </section>
  );
}

/** A new personal best. Gold is reserved for this, and always with the glyph. */
export function WinCard({ record }: { record: PersonalRecord }) {
  return (
    <section
      className="card relative overflow-hidden p-4"
      style={{ borderColor: 'rgba(245,196,81,0.30)' }}
    >
      <div className="absolute inset-0 bg-record-dim" aria-hidden />
      <div className="relative">
        <p className="label flex items-center gap-1.5" style={{ color: ACCENT_HEX.record }}>
          <TrophyGlyph />
          New personal best
        </p>
        <p className="mt-2.5 text-[15px] font-[560]">{record.label}</p>
        <p className="readout mt-1.5 text-[36px]" style={{ color: ACCENT_HEX.record }}>
          {record.display}
        </p>
        {record.previousDisplay && (
          <p className="mt-2 text-[12.5px] text-chalk-45">
            Previous best {record.previousDisplay}
            {record.previousDate && ` · ${fmtDate(record.previousDate)}`}
          </p>
        )}
        <p className="mt-2 text-[12.5px] leading-relaxed text-chalk-45">{record.blurb}</p>
      </div>
    </section>
  );
}

/** The single thing worth acting on. Exactly one — a list of nine is a list nobody uses. */
export function OneThingCard({ insight }: { insight: Insight }) {
  const hex = ACCENT_HEX[insight.accent as Accent];
  return (
    <section className="card p-4">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-pill" style={{ background: hex }} aria-hidden />
        <p className="label text-chalk-30">
          {insight.tone === 'win' ? 'Worth noticing' : insight.tone === 'watch' ? 'One thing' : 'A pattern'}
        </p>
      </div>

      <p className="mt-2.5 text-[16px] font-[620] leading-snug tracking-tightest">{insight.title}</p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-chalk-70">{insight.evidence}</p>

      <div className="mt-3.5 rounded-[12px] bg-surface-inset p-3">
        <p className="text-[13.5px] leading-relaxed">{insight.action}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-chalk-45">
          <span className="label mr-1.5 text-chalk-30">Why</span>
          {insight.because}
        </p>
      </div>
    </section>
  );
}

/** Reclaimed time — the headline the product wants a user to leave with. */
export function ReclaimedCard({ reclaimed, window }: { reclaimed: Reclaimed; window: string }) {
  if (!reclaimed.available) {
    return (
      <section className="card p-4">
        <p className="label text-chalk-30">Time reclaimed</p>
        <p className="mt-2.5 text-[14px] leading-relaxed text-chalk-45">
          Reclaimed time compares each day against your own normal, so it appears once there are
          enough measured days to have a normal. Keep the app installed and it fills in.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label text-chalk-30">Time reclaimed · {window}</p>
      </div>
      <p className="readout mt-2 text-[44px]" style={{ color: ACCENT_HEX.recovery }}>
        {fmtMin(reclaimed.minutes)}
      </p>
      <p className="mt-1.5 text-[12.5px] text-chalk-45">
        Against your own baseline, across {reclaimed.days} measured days.
      </p>

      {reclaimed.breakdown.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {reclaimed.breakdown.map((b) => (
            <li key={b.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-chalk-70">{b.label}</span>
                <span className="text-[13px] font-[620] tabular-nums">{fmtMin(b.minutes)}</span>
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-chalk-30">{b.detail}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-chalk-30">
        Focus time is never counted here. Doing less work is not the same as reclaiming time, and
        counting it would turn this number into a reward for avoidance.
      </p>
    </section>
  );
}

/** Mileage summary for the day. The base unit, always with its definition attached. */
export function MileageCard({
  miles,
  activeMin,
  scrollMeters,
}: {
  miles: { total: number; focus: number; scatter: number; scroll: number; recovery: number };
  activeMin: number;
  scrollMeters: number;
}) {
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label text-chalk-30">Mind Miles today</p>
        <Link href="/method" className="label text-chalk-30 transition-colors hover:text-chalk-70">
          1 mi = 20 min
        </Link>
      </div>

      <div className="mt-2 flex items-end gap-3">
        <span className="readout text-[46px]">{fmtMiles(miles.total)}</span>
        <span className="pb-2 text-[13px] text-chalk-45">{fmtMin(activeMin)} engaged</span>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2">
        {(
          [
            ['Focus', miles.focus, 'focus'],
            ['Scattered', miles.scatter, 'scatter'],
            ['Scroll', miles.scroll, 'strain'],
          ] as const
        ).map(([label, value, accent]) => (
          <div key={label} className="rounded-[12px] bg-surface-inset px-3 py-2.5">
            <dt className="label flex items-center gap-1.5 text-chalk-30">
              <span
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: ACCENT_HEX[accent] }}
                aria-hidden
              />
              {label}
            </dt>
            <dd className="readout mt-1.5 text-[20px]">{fmtMiles(value)}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3.5 text-[11.5px] leading-relaxed text-chalk-30">
        Scroll distance {fmtDistanceLabel(scrollMeters)} — estimated from a nominal CSS pixel, not a
        measurement of your glass.
      </p>
    </section>
  );
}

function fmtDistanceLabel(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  if (meters >= 10) return `${Math.round(meters)} m`;
  return `${meters.toFixed(1)} m`;
}

function TrophyGlyph() {
  return (
    <svg width={12} height={12} viewBox="0 0 20 20" fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 3.6h8v3.2a4 4 0 0 1-8 0V3.6Z" stroke="currentColor" />
      <path d="M6 4.6H3.6v1.2A2.6 2.6 0 0 0 6 8.3M14 4.6h2.4v1.2A2.6 2.6 0 0 1 14 8.3" stroke="currentColor" />
      <path d="M10 10.8v3.1M7.2 16.4h5.6" stroke="currentColor" />
    </svg>
  );
}
