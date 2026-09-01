'use client';

import Link from 'next/link';
import { useMindMiles } from '@/components/MindMilesProvider';
import {
  BrightnessControl,
  DataControls,
  IntentionsControl,
  ManualLog,
  ProfileControls,
  SharingControls,
  setBrightness,
} from '@/components/profile/Controls';
import { streakOf } from '@/lib/mm/baseline';
import { fmtDate, fmtMiles, fmtMin } from '@/lib/mm/format';
import { totalMileage } from '@/lib/mm/metrics';
import { tracker } from '@/lib/mm/tracker';
import { ACCENT_HEX } from '@/components/ui/tokens';
import { Mark } from '@/components/brand/Logo';

/**
 * PROFILE.
 *
 * Identity, achievement, and every control over what is measured and what is
 * kept. The order is deliberate: what you have done, then what you can change,
 * then how to take your data and leave.
 */
export default function ProfilePage() {
  const { state, summaries, records, challenges, reclaimedMonth, live, refresh, fitness } =
    useMindMiles();

  const completed = challenges.filter((c) => c.status === 'complete').length;
  const miles = totalMileage(summaries);
  const streak = streakOf(summaries, (s) => s.lateNightMin < 20 && s.breakCount >= 1);

  return (
    <div className="mx-auto flex max-w-app flex-col gap-3.5 md:max-w-none md:grid md:grid-cols-2 md:items-start md:gap-4">
      {/* ── identity ─────────────────────────────────────── */}
      <section className="card p-5 md:col-span-2">
        <div className="flex items-center gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-surface-inset"
            style={{ color: ACCENT_HEX.focus }}
          >
            <Mark size={30} />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[21px] font-[620] tracking-tightest">
              {state.profile.displayName}
            </h1>
            <p className="label mt-1 text-chalk-30">Screen Fitness {fitness}</p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Mind Miles" value={fmtMiles(miles.total)} note="all time" />
          <Tile label="Best evers" value={String(records.length)} accent={ACCENT_HEX.record} />
          <Tile label="Challenges" value={String(completed)} note="done" />
          <Tile
            label="Time got back"
            value={reclaimedMonth.available ? fmtMin(reclaimedMonth.minutes) : '—'}
            note="30 days"
            accent={ACCENT_HEX.recovery}
          />
        </dl>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hair pt-3.5">
          <p className="text-[12.5px] text-chalk-45">
            {streak > 0 ? (
              <>
                <span className="font-[620] text-chalk">{streak} days</span> in a row with a clear
                evening and a proper break
              </>
            ) : (
              'No streak going. A day away from your devices never breaks one.'
            )}
          </p>
          <Link
            href="/share"
            className="label ml-auto rounded-pill border border-hair px-3 py-1.5 text-chalk-70 transition-colors hover:border-hair-strong hover:text-chalk"
          >
            Share
          </Link>
        </div>
      </section>

      {/* ── records ──────────────────────────────────────── */}
      <section className="card p-4 md:col-span-2">
        <p className="label text-chalk-30">Your best ever</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-chalk-45">
          You cannot win any of these by leaving your phone in a drawer — each one needs a real day
          of screen time behind it first.
        </p>

        {records.length === 0 ? (
          <p className="mt-3.5 text-[13.5px] text-chalk-45">
            Nothing yet. These show up once there are a few days to compare.
          </p>
        ) : (
          <ul className="mt-3.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {records.map((r) => (
              <li key={r.key} className="rounded-[14px] bg-surface-inset p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-chalk-70">{r.label}</span>
                  {r.isNew && (
                    <span
                      className="label rounded-pill px-1.5 py-0.5"
                      style={{ color: ACCENT_HEX.record, background: 'rgba(245,196,81,0.12)' }}
                    >
                      New
                    </span>
                  )}
                </div>
                <p className="readout mt-1.5 text-[24px]">{r.display}</p>
                <p className="mt-1.5 text-[11.5px] text-chalk-30">
                  {fmtDate(r.date)}
                  {r.previousDisplay && ` · old best ${r.previousDisplay}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── controls ─────────────────────────────────────── */}
      <IntentionsControl state={state} onChange={refresh} />
      <BrightnessControl
        value={state.brightness}
        source={live?.brightnessSource ?? 'declared'}
        onChange={(v) => {
          setBrightness(v);
          tracker().setDeclaredBrightness(v);
          refresh();
        }}
      />
      <ManualLog onAdd={refresh} />
      <ProfileControls state={state} onChange={refresh} />
      <SharingControls state={state} onChange={refresh} />
      <DataControls state={state} onChange={refresh} />

      <p className="text-[11.5px] leading-relaxed text-chalk-30 md:col-span-2">
        <Link href="/guide" className="text-chalk-45 underline underline-offset-2 hover:text-chalk">
          What the numbers mean
        </Link>{' '}
        ·{' '}
        <Link href="/welcome" className="text-chalk-45 underline underline-offset-2 hover:text-chalk">
          What Mind Miles is for
        </Link>{' '}
        ·{' '}
        <Link href="/method" className="text-chalk-45 underline underline-offset-2 hover:text-chalk">
          How we work all this out
        </Link>{' '}
        ·{' '}
        <Link href="/privacy" className="text-chalk-45 underline underline-offset-2 hover:text-chalk">
          What we know about you
        </Link>
      </p>
    </div>
  );
}

function Tile({
  label,
  value,
  note,
  accent,
}: {
  label: string;
  value: string;
  note?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-[12px] bg-surface-inset px-3 py-2.5">
      <dt className="label text-chalk-30">{label}</dt>
      <dd className="readout mt-1.5 text-[21px]" style={accent ? { color: accent } : undefined}>
        {value}
      </dd>
      {note && <p className="mt-1 text-[10.5px] text-chalk-30">{note}</p>}
    </div>
  );
}
