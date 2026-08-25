'use client';

import { useMemo, useState } from 'react';
import { useMindMiles } from '@/components/MindMilesProvider';
import MileageChart from '@/components/charts/MileageChart';
import TrendLine, { type TrendPoint } from '@/components/charts/TrendLine';
import DayTimeline from '@/components/charts/DayTimeline';
import BaselineBar from '@/components/charts/BaselineBar';
import MetricCard from '@/components/ui/MetricCard';
import { fmtDate, fmtMiles, fmtMin, fmtPercent } from '@/lib/mm/format';
import { totalMileage, totalScroll } from '@/lib/mm/metrics';
import type { MetricId } from '@/lib/mm/types';
import { ACCENT_HEX, METRIC_ACCENT } from '@/components/ui/tokens';

/**
 * TRENDS.
 *
 * Mobile gets the glance; this is where the analysis lives. On a phone it reads
 * as a single column of charts; on a desktop it opens out, because reflection is
 * a sitting-down activity and motivation is a standing-up one.
 */

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;

const SERIES: { id: MetricId; label: string }[] = [
  { id: 'fitness', label: 'Screen Fitness' },
  { id: 'focus', label: 'Focus' },
  { id: 'fragmentation', label: 'Jumpiness' },
  { id: 'recovery', label: 'Rest' },
];

export default function TrendsPage() {
  const { reports, summaries, baseline, byDate, today } = useMindMiles();
  const [days, setDays] = useState<number>(30);
  const [selected, setSelected] = useState<string>(today.date);
  const [series, setSeries] = useState<MetricId>('fitness');

  const window = useMemo(() => summaries.slice(-days), [summaries, days]);
  const windowReports = useMemo(() => reports.slice(-days), [reports, days]);
  const miles = useMemo(() => totalMileage(window), [window]);

  const points: TrendPoint[] = useMemo(
    () =>
      windowReports.map((r) => ({
        date: r.date,
        value: r.byId[series].value,
        // A day with no measurement is a gap, never a zero — plotting an absence
        // as a low score would invent a bad day out of a day off.
        missing: r.summary.activeMin < 15 || r.byId[series].provenance === 'unavailable',
      })),
    [windowReports, series],
  );

  const seriesBaseline = baseline.normal(series, today.date);
  const selectedReport = byDate.get(selected) ?? today;

  const thisWeek = summaries.slice(-7);
  const lastWeek = summaries.slice(-14, -7);
  const thisMiles = totalMileage(thisWeek);
  const lastMiles = totalMileage(lastWeek);
  const focusChange =
    lastMiles.focus > 0.5 ? ((thisMiles.focus - lastMiles.focus) / lastMiles.focus) * 100 : null;
  const scrollChange =
    lastMiles.scroll > 0.5 ? ((thisMiles.scroll - lastMiles.scroll) / lastMiles.scroll) * 100 : null;

  return (
    <div className="mx-auto flex max-w-app flex-col gap-3.5 md:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-[620] tracking-tightest">Trends</h1>
        {/* Filters sit in one row above the charts, never between them. */}
        <div role="group" aria-label="Date range" className="flex gap-1 rounded-pill bg-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              aria-pressed={days === r.days}
              className={`rounded-pill px-3 py-1 text-[12.5px] transition-colors ${
                days === r.days ? 'bg-surface-inset text-chalk' : 'text-chalk-45 hover:text-chalk'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <section className="card p-4">
        <MileageChart days={window} selected={selected} onSelect={setSelected} />
        <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Total" value={`${fmtMiles(miles.total)} mi`} />
          <Stat label="Focus" value={`${fmtMiles(miles.focus)} mi`} accent={ACCENT_HEX.focus} />
          {/* Shown as time, not miles. Recovery mileage sitting beside focus
              mileage invites a comparison that means nothing — they measure
              opposite things, and the recovery figure is always the larger. */}
          <Stat
            label="Recovery"
            value={fmtMin(miles.recovery * 20)}
            accent={ACCENT_HEX.recovery}
            note="in breaks"
          />
          <Stat label="Scrolled" value={totalScroll(window)} note="roughly" />
        </dl>
      </section>

      <section className="card p-4">
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {SERIES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSeries(s.id)}
              aria-pressed={series === s.id}
              className={`rounded-pill px-3 py-1 text-[12.5px] transition-colors ${
                series === s.id
                  ? 'bg-surface-inset text-chalk'
                  : 'text-chalk-45 hover:bg-surface-raised hover:text-chalk'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <TrendLine
          points={points}
          title={SERIES.find((s) => s.id === series)!.label}
          accent={METRIC_ACCENT[series]}
          baseline={seriesBaseline?.value}
        />
        <p className="mt-3 text-[11.5px] leading-relaxed text-chalk-30">
          Days with almost no screen time show as gaps, not zeroes. A day away from your devices is
          not a bad day.
        </p>
      </section>

      <section className="card p-4">
        <p className="label text-chalk-30">Your week</p>
        <p className="mt-2.5 text-[15px] leading-relaxed text-chalk-70">
          {thisMiles.total < 1
            ? 'Not enough measured time this week to summarise yet.'
            : `${fmtMiles(thisMiles.total)} Mind Miles, of which ${fmtMiles(thisMiles.focus)} were focus miles.` +
              (focusChange !== null ? ` Focused time ${fmtPercent(focusChange)} on last week.` : '') +
              (scrollChange !== null ? ` Fast scrolling ${fmtPercent(scrollChange)}.` : '')}
        </p>

        <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
          <BaselineBar
            label="Time on screen today"
            value={today.summary.activeMin}
            baseline={baseline.normal('activeMin', today.date)?.value}
            max={480}
            accent="focus"
            format={fmtMin}
            lowerIsBetter
          />
          <BaselineBar
            label="Longest stretch without a break"
            value={today.summary.longestBoutMin}
            baseline={baseline.normal('longestBoutMin', today.date)?.value}
            max={120}
            accent="strain"
            format={fmtMin}
            lowerIsBetter
          />
          <BaselineBar
            label="Fast scrolling"
            value={today.summary.burstMin}
            baseline={baseline.normal('burstMin', today.date)?.value}
            max={90}
            accent="strain"
            format={fmtMin}
            lowerIsBetter
          />
          <BaselineBar
            label="Breaks you took"
            value={today.summary.breakCount}
            baseline={baseline.normal('breakCount', today.date)?.value}
            max={8}
            accent="recovery"
            format={(n) => `${Math.round(n)}`}
          />
        </div>
      </section>

      <section className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="label text-chalk-30">{fmtDate(selected)}</p>
          <button
            type="button"
            onClick={() => setSelected(today.date)}
            className="label text-chalk-30 transition-colors hover:text-chalk-70"
          >
            Back to today
          </button>
        </div>

        <div className="mt-3.5">
          <DayTimeline day={selectedReport.summary} title="Your day, hour by hour" />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {(['focus', 'recovery', 'strain', 'visual', 'fragmentation', 'intentionality'] as const).map(
            (id) => (
              <MetricCard key={id} metric={selectedReport.byId[id]} compact />
            ),
          )}
        </div>

        {selectedReport.summary.bouts.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-[13px]">
              <caption className="sr-only">
                Every visit to the screen on {selected}, with when it started, how long it lasted, and what you did.
              </caption>
              <thead>
                <tr className="label text-chalk-30">
                  <th scope="col" className="py-2 font-normal">Started</th>
                  <th scope="col" className="py-2 font-normal">Length</th>
                  <th scope="col" className="py-2 text-right font-normal">Keys</th>
                  <th scope="col" className="py-2 text-right font-normal">Scroll</th>
                  <th scope="col" className="py-2 text-right font-normal">Jumps</th>
                </tr>
              </thead>
              <tbody>
                {selectedReport.summary.bouts.map((b) => (
                  <tr key={`${b.startMin}-${b.source}`} className="border-t border-hair">
                    <td className="py-2 tabular-nums text-chalk-70">
                      {String(Math.floor(b.startMin / 60)).padStart(2, '0')}:
                      {String(b.startMin % 60).padStart(2, '0')}
                      {b.label && <span className="ml-2 text-chalk-30">{b.label}</span>}
                      {b.source === 'logged' && (
                        <span className="label ml-2 rounded-pill border border-hair px-1.5 py-0.5 text-chalk-30">
                          logged
                        </span>
                      )}
                    </td>
                    <td className="py-2 tabular-nums">{fmtMin(b.endMin - b.startMin + 1)}</td>
                    <td className="py-2 text-right tabular-nums text-chalk-45">
                      {b.keys.toLocaleString()}
                    </td>
                    <td className="py-2 text-right tabular-nums text-chalk-45">
                      {(b.scrollPx / 1000).toFixed(1)}k
                    </td>
                    <td className="py-2 text-right tabular-nums text-chalk-45">{b.switches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  note,
}: {
  label: string;
  value: string;
  accent?: string;
  note?: string;
}) {
  return (
    <div className="rounded-[12px] bg-surface-inset px-3 py-2.5">
      <dt className="label text-chalk-30">{label}</dt>
      <dd className="readout mt-1.5 text-[19px]" style={accent ? { color: accent } : undefined}>
        {value}
      </dd>
      {note && <p className="mt-1 text-[10.5px] text-chalk-30">{note}</p>}
    </div>
  );
}
