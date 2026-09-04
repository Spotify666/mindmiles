'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePhoton } from '@/components/PhotonProvider';
import DayTimeline from '@/components/charts/DayTimeline';
import Ring from '@/components/ui/Ring';
import MetricCard from '@/components/ui/MetricCard';
import LiveNow from '@/components/today/LiveNow';
import InstallBanner from '@/components/InstallBanner';
import TopSites from '@/components/today/TopSites';
import { TimeCard, OneThingCard, StoryCard, WinCard } from '@/components/today/Cards';
import { recordsSetOn } from '@/lib/mm/records';
import { fmtSigned, todayLabel } from '@/lib/mm/labels';
import { ACCENT_HEX } from '@/components/ui/tokens';
import { Counting, Enter } from '@/components/ui/motion';
import { useRouter } from 'next/navigation';

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
 *
 * A first visit is sent to /welcome instead. Landing a stranger on six numbers
 * that mean nothing yet explains nothing about what they have opened, so the
 * door is the idea first and the dashboard from the second visit on — but the
 * welcome lives at its own address rather than inside this one, so it stays
 * reachable afterwards.
 */
export default function TodayPage() {
  const mm = usePhoton();
  const { today, fitness, fitnessLastMonth, records, insights, story, storageBlocked } = mm;

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

  // Send a first-timer to the welcome. Done in an effect rather than by
  // rendering it here, so there is exactly one welcome and one URL for it.
  const router = useRouter();
  useEffect(() => {
    if (!mm.state.onboarded) router.replace('/welcome');
  }, [mm.state.onboarded, router]);

  if (!mm.state.onboarded) return null;

  return (
    <div className="mx-auto flex max-w-app flex-col gap-3.5 md:max-w-none md:grid md:grid-cols-12 md:items-start md:gap-4">
      {storageBlocked && (
        <p className="rounded-card border border-effort/40 bg-effort-wash p-3 text-[12.5px] leading-relaxed text-ink-soft md:col-span-12">
          Your browser is not letting us save anything, so today will disappear when you close this
          tab. Nothing went anywhere — there is nowhere for it to go.
        </p>
      )}

      <div className="md:col-span-12">
        <InstallBanner />
      </div>

      {/* ── status ─────────────────────────────────────────── */}
      <Enter as="section" index={0} className="card relative p-5 md:col-span-5">
        <span className="tape left-9" aria-hidden />
        <div className="flex items-baseline justify-between gap-3">
          <p className="label text-ink-faint">{todayLabel(today.date)}</p>
        </div>

        <div className="mt-4 flex items-center gap-5">
          <Ring value={fitness} accent="gold" size={124}>
            <span className="readout text-[40px]" style={{ color: ACCENT_HEX.gold }}>
              <Counting value={fitness} duration={1100} />
            </span>
            <span className="label mt-1.5 text-ink-faint">Fitness</span>
          </Ring>

          <div className="min-w-0">
            <p className="text-[17px] font-bold leading-snug tracking-tightest">
              {today.fitness.bandLabel}
            </p>
            <p className="label mt-1.5 text-ink-faint">
              {monthChange === null
                ? 'still learning your normal'
                : `${monthChange === 0 ? 'level' : fmtSigned(monthChange)} this month`}
            </p>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
              This covers your last seven days, not just today. One rough day should not decide how
              you are doing.
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-ink/15 pt-3.5">
          <p className="text-[13.5px] leading-relaxed text-ink-soft">{today.fitness.headline}</p>
        </div>
      </Enter>

      <Enter index={1} className="md:col-span-7">
        <TimeCard
          miles={today.summary.miles}
          activeMin={today.summary.activeMin}
          scrollMeters={today.summary.scrollMeters}
        />
      </Enter>

      {/* ── the six ────────────────────────────────────────── */}
      <Enter as="section" index={2} className="md:col-span-12">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard metric={today.focus} />
          <MetricCard metric={today.recovery} />
          <MetricCard metric={today.strain} />
          <MetricCard metric={today.visual} />
          <MetricCard metric={today.fragmentation} />
          <MetricCard metric={today.intentionality} />
        </div>
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-faint">
          Tap any score to see what went into it.{' '}
          <Link href="/guide" className="text-ink-faint underline underline-offset-2 hover:text-ink">
            Or read what they all mean
          </Link>
          .
        </p>
      </Enter>

      {/* ── the day ────────────────────────────────────────── */}
      <Enter as="section" index={3} className="card p-4 md:col-span-7">
        <DayTimeline day={today.summary} />
      </Enter>

      <Enter index={4} className="md:col-span-5">
        <TopSites date={today.date} />
      </Enter>

      <Enter index={5} className="flex flex-col gap-3.5 md:col-span-7">
        <StoryCard story={story} />
        {win && <WinCard record={win} />}
        {insight && <OneThingCard insight={insight} />}
      </Enter>

      {/* ── live, last ─────────────────────────────────────── */}
      <Enter index={6} className="md:col-span-12">
        <LiveNow />
      </Enter>

      <p className="text-[11.5px] leading-relaxed text-ink-faint md:col-span-12">
        Everything here was worked out in this browser and saved on this device. We count key
        presses; we never see which keys. Nothing is uploaded, because there is nowhere to upload
        it to.{' '}
        <Link href="/method" className="text-ink-faint underline underline-offset-2 hover:text-ink">
          How we work all this out
        </Link>
        .
      </p>
    </div>
  );
}
