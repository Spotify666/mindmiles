'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useMindMiles } from '@/components/MindMilesProvider';
import DayTimeline from '@/components/charts/DayTimeline';
import Ring from '@/components/ui/Ring';
import MetricCard from '@/components/ui/MetricCard';
import LiveNow from '@/components/today/LiveNow';
import { MileageCard, OneThingCard, StoryCard, WinCard } from '@/components/today/Cards';
import { recordsSetOn } from '@/lib/mm/records';
import { fmtSigned, todayLabel } from '@/lib/mm/labels';
import { ACCENT_HEX } from '@/components/ui/tokens';

/**
 * TODAY.
 *
 * The screen answers one question — how am I doing digitally today — and it has
 * to answer it in about five seconds, so the order is: status, then mileage,
 * then the six metrics, then words.
 *
 * The live readout is at the BOTTOM. That placement is the product argument
 * made in layout: if watching a counter climb were the point, this would be a
 * screen-time app. The point is the summary, and a user who never scrolls this
 * far has still got what they came for.
 */
export default function TodayPage() {
  const mm = useMindMiles();
  const { today, fitness, fitnessLastMonth, records, insights, story, live, storageBlocked } = mm;

  const newToday = recordsSetOn(records, today.date).filter((r) => r.isNew);
  const win = newToday[0];
  const insight = insights[0];
  const monthChange = fitnessLastMonth === null ? null : fitness - fitnessLastMonth;

  // Once a record has been on screen it stops reading as new, so the same
  // achievement is not re-announced every time the app is opened.
  useEffect(() => {
    if (newToday.length > 0) {
      const id = setTimeout(() => mm.markRecordsSeen(), 4000);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newToday.length]);

  return (
    <div className="mx-auto flex max-w-app flex-col gap-3.5 md:max-w-none md:grid md:grid-cols-12 md:items-start md:gap-4">
      {storageBlocked && (
        <p className="rounded-card border border-strain/30 bg-strain-dim p-3 text-[12.5px] leading-relaxed text-chalk-70 md:col-span-12">
          Your browser is not letting us save anything, so today will disappear when you close this
          tab. Nothing went anywhere — there is nowhere for it to go.
        </p>
      )}

      {/* ── status ─────────────────────────────────────────── */}
      <section className="card p-5 md:col-span-5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="label text-chalk-30">{todayLabel(today.date)}</p>
        </div>

        <div className="mt-4 flex items-center gap-5">
          <Ring value={fitness} accent="record" size={124}>
            <span className="readout text-[40px]" style={{ color: ACCENT_HEX.record }}>
              {fitness}
            </span>
            <span className="label mt-1.5 text-chalk-30">Fitness</span>
          </Ring>

          <div className="min-w-0">
            <p className="text-[17px] font-[620] leading-snug tracking-tightest">
              {today.fitness.bandLabel}
            </p>
            <p className="label mt-1.5 text-chalk-45">
              {monthChange === null
                ? 'still learning your normal'
                : `${monthChange === 0 ? 'level' : fmtSigned(monthChange)} this month`}
            </p>
            <p className="mt-3 text-[12.5px] leading-relaxed text-chalk-45">
              This covers your last seven days, not just today. One rough day should not decide how
              you are doing.
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-hair pt-3.5">
          <p className="text-[13.5px] leading-relaxed text-chalk-70">{today.fitness.headline}</p>
        </div>
      </section>

      <div className="md:col-span-7">
        <MileageCard
          miles={today.summary.miles}
          activeMin={today.summary.activeMin}
          scrollMeters={today.summary.scrollMeters}
        />
      </div>

      {/* ── the six ────────────────────────────────────────── */}
      <section className="md:col-span-12">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard metric={today.focus} />
          <MetricCard metric={today.recovery} />
          <MetricCard metric={today.strain} />
          <MetricCard metric={today.visual} />
          <MetricCard metric={today.fragmentation} />
          <MetricCard metric={today.intentionality} />
        </div>
        <p className="mt-2.5 text-[11.5px] text-chalk-30">
          Tap any score to see what went into it, in plain words.
        </p>
      </section>

      {/* ── the day ────────────────────────────────────────── */}
      <section className="card p-4 md:col-span-7">
        <DayTimeline day={today.summary} />
      </section>

      <div className="flex flex-col gap-3.5 md:col-span-5">
        <StoryCard story={story} />
        {win && <WinCard record={win} />}
        {insight && <OneThingCard insight={insight} />}
      </div>

      {/* ── live, last ─────────────────────────────────────── */}
      <div className="md:col-span-12">
        <LiveNow live={live} />
      </div>

      <p className="text-[11.5px] leading-relaxed text-chalk-30 md:col-span-12">
        Everything here was worked out in this browser and saved on this device. We count key
        presses; we never see which keys. Nothing is uploaded, because there is nowhere to upload
        it to.{' '}
        <Link href="/method" className="text-chalk-45 underline underline-offset-2 hover:text-chalk">
          How we work all this out
        </Link>
        .
      </p>
    </div>
  );
}
