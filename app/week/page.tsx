'use client';

import Link from 'next/link';
import { usePhoton } from '@/components/PhotonProvider';
import MileageChart from '@/components/charts/MileageChart';
import { fmtDate, fmtMiles, fmtMin, fmtPercent, plural } from '@/lib/mm/format';
import { ACCENT_HEX } from '@/components/ui/tokens';
import { Enter } from '@/components/ui/motion';

/**
 * YOUR WEEK.
 *
 * The one screen this product is actually for.
 *
 * Trends is a place you go to investigate; this is a thing that is finished on
 * a Sunday and worth five minutes. It is the only honest shape for an app that
 * has promised not to reward being opened — a daily habit loop would need a
 * streak, and a streak would need a punishment, and this app does not have one
 * to give.
 *
 * So it reads top to bottom like something written for you: what the week was,
 * what changed, the day that went best, what you won back, and one thing to
 * try. There is no weekly score anywhere on it, on purpose — a week is a piece
 * of somebody's life, not a test they sat.
 */
export default function WeekPage() {
  const { week, summaries } = usePhoton();
  const last7 = summaries.slice(-7);

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-6 pb-6">
      <Enter as="section" index={0} className="pt-6">
        <p className="label text-ink-faint">
          {week.from && week.to ? `${fmtDate(week.from)} – ${fmtDate(week.to)}` : 'This week'}
        </p>
        <h1 className="display mt-2 text-[30px] leading-[1.08]">Your week.</h1>
        <p className="mt-3 text-[15.5px] leading-relaxed text-ink-soft">{week.headline}</p>
      </Enter>

      {!week.ready ? (
        <Enter as="section" index={1} className="card p-5">
          <p className="text-[14px] leading-relaxed text-ink-soft">
            A week needs at least three days in it before it says anything true. Keep the app open
            on the days you are working and come back — there is nothing to set up.
          </p>
          <Link href="/" className="btn mt-4 inline-block">
            Back to today
          </Link>
        </Enter>
      ) : (
        <>
          <Enter as="section" index={1} className="card p-5">
            <div className="mt-1">
              <MileageChart days={last7} title="Where the week went" />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              <Figure label="Deep" value={`${fmtMiles(week.miles.focus)} mi`} accent={ACCENT_HEX.focus} />
              <Figure label="In bits" value={`${fmtMiles(week.miles.scatter)} mi`} accent={ACCENT_HEX.neutral} />
              <Figure label="Went past fast" value={`${fmtMiles(week.miles.scroll)} mi`} accent={ACCENT_HEX.jumpy} />
            </dl>
          </Enter>

          {(week.focusChange !== null || week.scrollChange !== null) && (
            <Enter as="section" index={2} className="card p-5">
              <p className="label text-ink-faint">Against last week</p>
              <ul className="mt-2.5 space-y-2 text-[14px] leading-relaxed">
                {week.focusChange !== null && (
                  <li>
                    Time in long blocks{' '}
                    <strong className={week.focusChange >= 0 ? 'text-rest-text' : 'text-effort'}>
                      {fmtPercent(week.focusChange)}
                    </strong>
                    .
                  </li>
                )}
                {week.scrollChange !== null && (
                  <li>
                    Fast scrolling{' '}
                    <strong className={week.scrollChange <= 0 ? 'text-rest-text' : 'text-effort'}>
                      {fmtPercent(week.scrollChange)}
                    </strong>
                    .
                  </li>
                )}
              </ul>
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
                Against your own last week, never against anybody else. There is no leaderboard in
                this app and there is not going to be one.
              </p>
            </Enter>
          )}

          {week.reclaimed.available && week.reclaimed.minutes >= 5 && (
            <Enter as="section" index={3} className="card p-5">
              <p className="label text-ink-faint">Time you got back</p>
              <p className="display mt-1.5 text-[38px] leading-none">
                {fmtMin(week.reclaimed.minutes)}
              </p>
              <ul className="mt-3.5 space-y-2">
                {week.reclaimed.breakdown.map((b) => (
                  <li key={b.label} className="flex items-baseline justify-between gap-4">
                    <span className="text-[13.5px]">{b.label}</span>
                    <span className="text-[13.5px] font-semibold tabular-nums">{fmtMin(b.minutes)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
                Time you would usually have spent scrolling, hopping about or up late, that you did
                not. Hours of work below your usual are never counted here — doing less work is not
                the same as winning time back.
              </p>
            </Enter>
          )}

          <Enter as="section" index={4} className="grid gap-3.5 sm:grid-cols-2">
            {week.bestDay && (
              <div className="card p-5">
                <p className="label text-ink-faint">Best day</p>
                <p className="mt-1.5 text-[17px] font-bold">{fmtDate(week.bestDay.date)}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                  {week.bestDay.report.fitness.headline}
                </p>
              </div>
            )}
            {week.hardestDay && (
              <div className="card p-5">
                <p className="label text-ink-faint">Hardest day</p>
                <p className="mt-1.5 text-[17px] font-bold">{fmtDate(week.hardestDay.date)}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">
                  {week.hardestDay.report.strain.headline}
                </p>
              </div>
            )}
          </Enter>

          {(week.records.length > 0 || week.blocksKept > 0) && (
            <Enter as="section" index={5} className="card p-5">
              <p className="label text-ink-faint">Worth keeping</p>
              <ul className="mt-2.5 space-y-2 text-[14px] leading-relaxed">
                {week.blocksKept > 0 && (
                  <li>
                    You set out to do {plural(week.blocksKept, 'block')} and saw{' '}
                    {week.blocksKept === 1 ? 'it' : 'them'} through.
                  </li>
                )}
                {week.records.map((r) => (
                  <li key={r.key}>
                    <strong>{r.label}</strong> — {r.display}, your best yet.
                  </li>
                ))}
              </ul>
            </Enter>
          )}

          {week.oneThing && (
            <Enter as="section" index={6} className="card p-5">
              <p className="label text-ink-faint">One thing for next week</p>
              <p className="mt-2 text-[15px] leading-relaxed">{week.oneThing}</p>
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
                One. Not a plan — a plan for next week is how a week goes wrong before it starts.
              </p>
            </Enter>
          )}
        </>
      )}

      <p className="pt-1 text-[12.5px] text-ink-faint">
        <Link href="/trends" className="underline underline-offset-2 hover:text-ink">
          Trends
        </Link>{' '}
        has the same days as charts you can pick apart.
      </p>
    </div>
  );
}

function Figure({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div>
      <dt className="label text-ink-faint">{label}</dt>
      <dd className="mt-1 text-[17px] font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </dd>
    </div>
  );
}
