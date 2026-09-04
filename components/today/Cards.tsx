'use client';

import Link from 'next/link';
import { fmtDate, fmtMin } from '@/lib/mm/format';
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
      <p className="label text-ink-faint">How today went</p>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink-soft">{story}</p>
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
      <div className="absolute inset-0 bg-gold-wash" aria-hidden />
      <div className="relative">
        <p className="label flex items-center gap-1.5 text-ink-faint" style={{ color: ACCENT_HEX.gold }}>
          <TrophyGlyph />
          Your best yet
        </p>
        <p className="mt-2.5 text-[15px] font-semibold">{record.label}</p>
        <p className="readout mt-1.5 text-[36px]" style={{ color: ACCENT_HEX.gold }}>
          {record.display}
        </p>
        {record.previousDisplay && (
          <p className="mt-2 text-[12.5px] text-ink-faint">
            Old best {record.previousDisplay}
            {record.previousDate && ` · ${fmtDate(record.previousDate)}`}
          </p>
        )}
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-faint">{record.blurb}</p>
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
        <p className="label text-ink-faint">
          {insight.tone === 'win' ? 'Nice one' : insight.tone === 'watch' ? 'One thing to try' : 'Something we noticed'}
        </p>
      </div>

      <p className="mt-2.5 text-[16px] font-bold leading-snug tracking-tightest">{insight.title}</p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">{insight.evidence}</p>

      <div className="mt-3.5 panel p-3">
        <p className="text-[13.5px] leading-relaxed">{insight.action}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
          <span className="label mr-1.5 text-ink-faint">Why</span>
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
        <p className="label text-ink-faint">Time you got back</p>
        <p className="mt-2.5 text-[14px] leading-relaxed text-ink-faint">
          This compares each day with a normal day for you — so it needs a few more days before it
          can say anything. Keep the app around and it fills in.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="label text-ink-faint">Time you got back · {window}</p>
      </div>
      <p className="readout mt-2 text-[44px]" style={{ color: ACCENT_HEX.rest }}>
        {fmtMin(reclaimed.minutes)}
      </p>
      <p className="mt-1.5 text-[12.5px] text-ink-faint">
        Compared with a normal {reclaimed.days} days for you.
      </p>

      {reclaimed.breakdown.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {reclaimed.breakdown.map((b) => (
            <li key={b.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-ink-soft">{b.label}</span>
                <span className="text-[13px] font-bold tabular-nums">{fmtMin(b.minutes)}</span>
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-ink-faint">{b.detail}</p>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11.5px] leading-relaxed text-ink-faint">
        Focused time never counts here. Getting less done is not the same as getting time back —
        counting it would just reward you for avoiding things.
      </p>
    </section>
  );
}

/**
 * The day's screen time, split three ways.
 *
 * This used to lead with an invented unit — "6.0 Mind Miles", with "1 mi = 20
 * min" printed beside it to explain itself. A number that needs a conversion
 * table next to it is a number nobody reads. It now shows hours and minutes,
 * which everyone already understands, and the split underneath is the part that
 * actually says something.
 */
export function TimeCard({
  miles,
  activeMin,
  scrollMeters,
}: {
  miles: { total: number; focus: number; scatter: number; scroll: number; recovery: number };
  activeMin: number;
  scrollMeters: number;
}) {
  const parts = [
    { label: 'Focused', minutes: miles.focus * 20, accent: 'focus' as const },
    { label: 'Bits and pieces', minutes: miles.scatter * 20, accent: 'jumpy' as const },
    { label: 'Scrolling', minutes: miles.scroll * 20, accent: 'effort' as const },
  ];

  return (
    <section className="card relative p-5">
      <span className="tape left-8" aria-hidden />

      <p className="label text-ink-faint">Time on screen today</p>
      <p className="readout mt-2 text-[46px]">{fmtMin(activeMin)}</p>

      {/* One bar, three parts, each directly labelled below. */}
      <div className="mt-4 flex h-3 w-full gap-[3px] overflow-hidden rounded-pill border-2 border-ink bg-paper p-[2px]">
        {parts.map((p) =>
          p.minutes < 1 ? null : (
            <span
              key={p.label}
              className="h-full rounded-pill"
              style={{
                width: `${(p.minutes / Math.max(activeMin, 1)) * 100}%`,
                background: ACCENT_HEX[p.accent],
              }}
            />
          ),
        )}
      </div>

      <dl className="mt-4 space-y-2.5">
        {parts.map((p) => (
          <div key={p.label} className="flex items-baseline gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: ACCENT_HEX[p.accent] }}
              aria-hidden
            />
            <dt className="text-[14px] text-ink-soft">{p.label}</dt>
            <dd className="ml-auto text-[15px] font-bold tabular-nums">{fmtMin(p.minutes)}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-faint">
        You scrolled about {fmtDistanceLabel(scrollMeters)} today — worked out from how far the page
        moved, so treat it as a rough figure.
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
